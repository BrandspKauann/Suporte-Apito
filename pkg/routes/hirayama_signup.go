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
	"net/http"
	"strings"

	"code.vikunja.io/api/pkg/modules/hirayama"
	"github.com/labstack/echo/v5"
)

func hirayamaSignupGuard(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		path := strings.TrimRight(c.Request().URL.Path, "/")
		registration := c.Request().Method == http.MethodPost && (path == "/api/v1/register" || path == "/api/v2/register")
		if !hirayama.SignupEnabled() || !registration {
			return next(c)
		}
		if !hirayama.ValidSignupCode(c.Request().Header.Get(hirayama.SignupHeader)) {
			return c.JSON(http.StatusForbidden, map[string]any{
				"status":  http.StatusForbidden,
				"message": "Código de convite inválido.",
				"detail":  "Código de convite inválido.",
			})
		}
		// Downstream handlers and error reporters only need the approval, not the code.
		c.Request().Header.Del(hirayama.SignupHeader)
		c.SetRequest(c.Request().WithContext(hirayama.ApproveRegistration(c.Request().Context())))
		return next(c)
	}
}
