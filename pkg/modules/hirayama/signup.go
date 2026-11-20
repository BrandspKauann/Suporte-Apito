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
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
)

const SignupHeader = "X-Apito-Signup-Code"

// The server stores a verifier, never the invitation code in frontend assets.

type registrationApprovalKey struct{}

func SignupEnabled() bool { return os.Getenv("APITO_SIGNUP_ENABLED") == "true" }

func ValidSignupCode(code string) bool {
	verifier := os.Getenv("APITO_SIGNUP_CODE_SHA256")
	if verifier == "" {
		return false
	}
	expected, err := hex.DecodeString(verifier)
	if err != nil || len(expected) != sha256.Size || strings.TrimSpace(code) == "" {
		return false
	}
	actual := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return subtle.ConstantTimeCompare(actual[:], expected) == 1
}

func ApproveRegistration(ctx context.Context) context.Context {
	return context.WithValue(ctx, registrationApprovalKey{}, true)
}

func RegistrationApproved(ctx context.Context) bool {
	approved, _ := ctx.Value(registrationApprovalKey{}).(bool)
	return approved
}

// Only server configuration can select the central support account.
func SupportUserID() (int64, error) {
	configured := os.Getenv("APITO_SUPPORT_USER_ID")
	if configured == "" {
		configured = "1"
	}
	id, err := strconv.ParseInt(configured, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid support account configuration")
	}
	return id, nil
}
