package imports

import (
	crand "crypto/rand"
	"math/rand"
)

func _() {
	_, _ = crand.Read(nil) // want `\Qcrypto/rand`
	_, _ = rand.Read(nil)  // want `\Qmath/rand`
}

func _() {
	_, _ = rand.Read(nil)  // want `\Qmath/rand`
	_, _ = crand.Read(nil) // want `\Qcrypto/rand`
}

func _() {
	var rand distraction
	_, _ = rand.Read(nil)
}

type distraction struct{}

func (distraction) Read(p []byte) (int, error) {
	return 0, nil
}

type (
	v1Impl struct{}
	v2Impl struct{}
	v3Impl struct{}
)

func (i *v1Impl) Do() {}

func (i *v2Impl) Do(x any) {}

func (i *v3Impl) Do(x int) {}

func json2() {
	var i1 *v1Impl
	var i2 *v2Impl
	var i3 *v3Impl
	_ = i1 // want `\Qv1 implemented`
	_ = i2 // want `\Qv2 implemented`
	_ = i3 // want `\Qv3 implemented`
}
