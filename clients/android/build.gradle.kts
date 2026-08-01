// ルートではプラグインを一切宣言しない。
//
// ここで `alias(libs.plugins.kotlin.jvm) apply false` を書くと
// kotlin-gradle-plugin がルートの buildscript クラスパスに載り、それが全
// サブプロジェクトに継承される。その状態で :sample が
// `org.jetbrains.kotlin.android` をバージョン付きで要求すると、同一アーティファクト
// (kotlin.jvm と kotlin.android は同じ KGP) が「バージョン不明でクラスパス上にある」
// と判定されて解決に失敗する:
//
//   Error resolving plugin [id: 'org.jetbrains.kotlin.android', version: '2.1.20']
//   > ...already on the classpath with an unknown version
//
// 各モジュールが自分に必要なプラグインだけを宣言すれば、継承が発生せず衝突しない。
// 併せて、Android SDK が無い環境で :spectre-core だけをビルドするときに
// AGP の解決 (google() への到達) を要求しなくなる利点もある。
