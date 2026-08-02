import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate, TemplateEvaluator } from '../src/template.js'
import { makeScope } from '../src/evaluator.js'

/**
 * Unit tests for template parsing.
 *
 * The conformance corpus fixes what interpolation *evaluates to*, but not which kind
 * (literal / whole / mixed) `parseTemplate` picks. That classification is what decides
 * whether the value's type survives (docs/spec/expression.md §1), so the classification
 * itself is pinned here. The path that degrades an unterminated `${` into a literal is
 * checked too — it is the reason a malformed string does not take the screen down.
 */

describe('parseTemplate', () => {
  test('a string with no $ is a literal', () => {
    assert.deepEqual(parseTemplate('こんにちは'), { kind: 'literal', text: 'こんにちは' })
    assert.deepEqual(parseTemplate(''), { kind: 'literal', text: '' })
  })

  test('a string with $ but no ${ is also a literal', () => {
    assert.deepEqual(parseTemplate('$1,000'), { kind: 'literal', text: '$1,000' })
    assert.deepEqual(parseTemplate('100$'), { kind: 'literal', text: '100$' })
  })

  test('exactly one ${...} spanning the whole string is "whole"', () => {
    assert.deepEqual(parseTemplate('${data.price}'), { kind: 'whole', source: 'data.price' })
  })

  test('surrounding text makes it "mixed"', () => {
    assert.deepEqual(parseTemplate('在庫: ${data.stock}'), {
      kind: 'mixed',
      parts: [
        { kind: 'text', text: '在庫: ' },
        { kind: 'expression', source: 'data.stock' },
      ],
    })
  })

  test('more than one expression makes it "mixed"', () => {
    const template = parseTemplate('${a}${b}')
    assert.equal(template.kind, 'mixed')
    assert.equal(template.kind === 'mixed' ? template.parts.length : 0, 2)
  })

  test('$${ escapes a literal ${', () => {
    assert.deepEqual(parseTemplate('$${data}'), { kind: 'literal', text: '${data}' })
    assert.deepEqual(parseTemplate('a$${b}c'), { kind: 'literal', text: 'a${b}c' })
  })

  test('an unterminated ${ is kept as a literal', () => {
    // Throwing here would mean "writing a string like $1,000 crashes the screen".
    assert.deepEqual(parseTemplate('${data.title'), { kind: 'literal', text: '${data.title' })
    assert.deepEqual(parseTemplate('前 ${壊れた'), { kind: 'literal', text: '前 ${壊れた' })
  })

  test('a } inside an object literal is not mistaken for the terminator', () => {
    assert.deepEqual(parseTemplate('${ {"a": 1}.a }'), { kind: 'whole', source: ' {"a": 1}.a ' })
  })

  test('a } inside a string literal is not mistaken for the terminator', () => {
    assert.deepEqual(parseTemplate('${ "}" }'), { kind: 'whole', source: ' "}" ' })
    assert.deepEqual(parseTemplate("${ '}' }"), { kind: 'whole', source: " '}' " })
  })

  test('escaped quotes inside a string literal are skipped', () => {
    assert.deepEqual(parseTemplate('${ "\\"}" }'), { kind: 'whole', source: ' "\\"}" ' })
  })
})

describe('TemplateEvaluator', () => {
  const scope = makeScope({
    data: { price: 1280, title: '商品', tags: ['a', 'b'] },
    state: { count: 0 },
  })

  test('"whole" preserves the evaluated type', () => {
    const result = new TemplateEvaluator().evaluate('${data.price}', scope)
    assert.equal(result.value, 1280)
    assert.equal(typeof result.value, 'number', 'it stays a number')
    assert.deepEqual(result.errors, [])
  })

  test('"mixed" stringifies each part and concatenates', () => {
    const result = new TemplateEvaluator().evaluate('${data.title}: ${data.price}円', scope)
    assert.equal(result.value, '商品: 1280円')
  })

  test('a literal comes back unchanged', () => {
    const result = new TemplateEvaluator().evaluate('ただの文字列', scope)
    assert.equal(result.value, 'ただの文字列')
    assert.deepEqual(result.errors, [])
  })

  test('an unparseable expression yields null and an error, never a throw', () => {
    const result = new TemplateEvaluator().evaluate('${1 +}', scope)
    assert.equal(result.value, null)
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0].code, 'E_PARSE')
  })

  test('a broken part of a mixed template still leaves the rest concatenated', () => {
    const result = new TemplateEvaluator().evaluate('前${1 +}後', scope)
    assert.equal(result.value, '前後', 'the broken part becomes empty')
    assert.equal(result.errors.length, 1)
  })

  test('parsed templates are reused', () => {
    const evaluator = new TemplateEvaluator()
    const first = evaluator.templateOf('${data.price}円')
    const second = evaluator.templateOf('${data.price}円')
    assert.equal(first, second)
  })

  test('precompile reports nothing for well-formed expressions', () => {
    assert.deepEqual(new TemplateEvaluator().precompile('${data.title}: ${data.price}'), [])
    assert.deepEqual(new TemplateEvaluator().precompile('ただの文字列'), [])
  })

  test('precompile checks every expression in a mixed template', () => {
    // The path that catches these at document load rather than mid-render.
    const errors = new TemplateEvaluator().precompile('${1 +}と${2 *}')
    assert.equal(errors.length, 2)
    assert.ok(errors.every((e) => e.code === 'E_PARSE'))
  })

  test('precompile checks a whole-template expression too', () => {
    const errors = new TemplateEvaluator().precompile('${(1}')
    assert.equal(errors.length, 1)
    assert.equal(errors[0].code, 'E_PARSE')
  })
})
