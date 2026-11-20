// Vikunja is a to-do list application to facilitate your life.
// Copyright 2018-present Vikunja and contributors. All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package hirayama

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestHirayamaSignupPolicy(t *testing.T) {
	t.Setenv("APITO_SIGNUP_CODE_SHA256", "")
	if ValidSignupCode("test-invitation") {
		t.Fatal("accepted invitation without installation verifier")
	}
	hash := sha256.Sum256([]byte("test-invitation"))
	t.Setenv("APITO_SIGNUP_CODE_SHA256", hex.EncodeToString(hash[:]))
	for _, invalid := range []string{"", " ", "incorrect", "test-invitation-extra"} {
		if ValidSignupCode(invalid) {
			t.Fatalf("accepted invalid invitation")
		}
	}
	if !ValidSignupCode("test-invitation") || !ValidSignupCode(" test-invitation ") {
		t.Fatal("rejected correct invitation")
	}
	if RegistrationApproved(context.Background()) || !RegistrationApproved(ApproveRegistration(context.Background())) {
		t.Fatal("registration approval did not remain scoped to its context")
	}
	t.Setenv("APITO_SUPPORT_USER_ID", "1")
	id, err := SupportUserID()
	if err != nil || id != 1 {
		t.Fatal("invalid support account")
	}
	for _, invalid := range []string{"0", "-1", "invalid"} {
		t.Setenv("APITO_SUPPORT_USER_ID", invalid)
		if _, err := SupportUserID(); err == nil {
			t.Fatal("accepted invalid support account")
		}
	}
}
