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

package routes

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"

	"code.vikunja.io/api/pkg/modules/hirayama"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
)

func TestHirayamaSignupGuard(t *testing.T) {
	t.Setenv("APITO_SIGNUP_ENABLED", "true")
	hash := sha256.Sum256([]byte("test-invitation"))
	t.Setenv("APITO_SIGNUP_CODE_SHA256", hex.EncodeToString(hash[:]))
	for _, path := range []string{"/api/v1/register", "/api/v2/register"} {
		for _, code := range []string{"", "incorrect", "test-invitation"} {
			e := echo.New()
			e.Use(hirayamaSignupGuard)
			called := false
			e.POST(path, func(c *echo.Context) error {
				called = true
				require.True(t, hirayama.RegistrationApproved(c.Request().Context()))
				return c.NoContent(http.StatusNoContent)
			})
			req := httptest.NewRequest(http.MethodPost, path, nil)
			req.Header.Set(hirayama.SignupHeader, code)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if code == "test-invitation" {
				require.Equal(t, http.StatusNoContent, rec.Code)
				require.True(t, called)
			} else {
				require.Equal(t, http.StatusForbidden, rec.Code)
				require.False(t, called, "invalid invitation reached account creation")
			}
		}
	}
}
