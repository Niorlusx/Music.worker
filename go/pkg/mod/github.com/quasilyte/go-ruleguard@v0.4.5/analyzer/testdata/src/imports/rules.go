//go:build ignore
// +build ignore

package gorules

import (
	"github.com/quasilyte/go-ruleguard/dsl"
)

func testMathRand(m dsl.Matcher) {
	m.Match(`rand.Read($*_)`).Report(`math/rand`)
}

func testCryptoRand(m dsl.Matcher) {
	m.Import(`crypto/rand`)
	m.Match(`rand.Read($*_)`).Report(`crypto/rand`)
}

func testImportV1(m dsl.Matcher) {
	m.Import(`github.com/quasilyte/go-ruleguard/analyzer/testdata/src/imports/mylib`)
	m.Match(`_ = $x`).
		Where(m["x"].Type.Implements(`mylib.Contract`)).
		Report(`v1 implemented`)
}

func testImportV2(m dsl.Matcher) {
	m.Import(`github.com/quasilyte/go-ruleguard/analyzer/testdata/src/imports/mylib/v2`)
	m.Match(`_ = $x`).
		Where(m["x"].Type.Implements(`mylib.Contract`)).
		Report(`v2 implemented`)
}

func testImportV3(m dsl.Matcher) {
	m.Import(`github.com/quasilyte/go-ruleguard/analyzer/testdata/src/imports/mylib/v3`)
	m.Match(`_ = $x`).
		Where(m["x"].Type.Implements(`mylib.Contract`)).
		Report(`v3 implemented`)
}
