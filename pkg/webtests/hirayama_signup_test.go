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

package webtests

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"code.vikunja.io/api/pkg/config"
	"code.vikunja.io/api/pkg/db"
	"code.vikunja.io/api/pkg/modules/hirayama"
	"code.vikunja.io/api/pkg/routes/api/shared"
	"code.vikunja.io/api/pkg/user"
	"github.com/stretchr/testify/require"
)

func TestHirayamaCompanyIsolation(t *testing.T) {
	t.Setenv("APITO_SIGNUP_ENABLED", "true")
	t.Setenv("APITO_SUPPORT_USER_ID", "1")
	hash := sha256.Sum256([]byte("test-invitation"))
	t.Setenv("APITO_SIGNUP_CODE_SHA256", hex.EncodeToString(hash[:]))
	e, err := setupTestEnv()
	require.NoError(t, err)
	config.ServiceEnableRegistration.Set(true)
	register := func(username, company, code string) *httptest.ResponseRecorder {
		body, marshalErr := json.Marshal(map[string]string{"username": username, "company_name": company, "email": username + "@example.com", "password": "test-password-123"})
		require.NoError(t, marshalErr)
		req := httptest.NewRequest(http.MethodPost, "/api/v2/register", strings.NewReader(string(body)))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set(hirayama.SignupHeader, code)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	for _, code := range []string{"", "incorrect"} {
		rec := register("company-alpha", "Alpha", code)
		require.Equal(t, http.StatusForbidden, rec.Code, rec.Body.String())
	}
	db.AssertMissing(t, "users", map[string]interface{}{"username": "company-alpha"})
	rec := register("company-alpha", "Alpha", "test-invitation")
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var alpha user.User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &alpha))
	rec = register("company-beta", "Beta", "test-invitation")
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var beta user.User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &beta))
	readSession := db.NewSession()
	storedAlpha, err := user.GetUserByID(readSession, alpha.ID)
	require.NoError(t, err)
	storedBeta, err := user.GetUserByID(readSession, beta.ID)
	require.NoError(t, err)
	alpha.DefaultProjectID = storedAlpha.DefaultProjectID
	beta.DefaultProjectID = storedBeta.DefaultProjectID
	require.NoError(t, readSession.Close())
	require.Positive(t, alpha.DefaultProjectID)
	require.NotEqual(t, alpha.DefaultProjectID, beta.DefaultProjectID)
	for _, account := range []*user.User{&alpha, &beta} {
		db.AssertMissing(t, "users_projects", map[string]interface{}{"user_id": account.ID, "project_id": 1})
		db.AssertExists(t, "projects", map[string]interface{}{"id": account.DefaultProjectID, "owner_id": 1}, false)
	}
	rec = register("duplicate-alpha", " alpha ", "test-invitation")
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var colleague user.User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &colleague))
	colleagueSession := db.NewSession()
	storedColleague, err := user.GetUserByID(colleagueSession, colleague.ID)
	require.NoError(t, err)
	require.Equal(t, alpha.DefaultProjectID, storedColleague.DefaultProjectID)
	require.NoError(t, colleagueSession.Close())
	rec = register("missing-company", " ", "test-invitation")
	require.GreaterOrEqual(t, rec.Code, 400, rec.Body.String())
	db.AssertMissing(t, "users", map[string]interface{}{"username": "missing-company"})
	loginBody := func(company string) string {
		body, marshalErr := json.Marshal(map[string]string{"username": "company-alpha@example.com", "password": "test-password-123", "company_name": company})
		require.NoError(t, marshalErr)
		return string(body)
	}
	for _, company := range []string{"", "Beta"} {
		login := adminReq(t, e, http.MethodPost, "/api/v2/login", nil, loginBody(company))
		require.GreaterOrEqual(t, login.Code, 400, login.Body.String())
	}
	login := adminReq(t, e, http.MethodPost, "/api/v2/login", nil, loginBody("alpha"))
	require.Equal(t, http.StatusOK, login.Code, login.Body.String())
	var loginData struct {
		Company shared.CompanyWorkspace `json:"company"`
		Token   string                  `json:"token"`
	}
	require.NoError(t, json.Unmarshal(login.Body.Bytes(), &loginData))
	require.Equal(t, "Alpha", loginData.Company.Name)
	betaLogin := adminReq(t, e, http.MethodPost, "/api/v2/login", nil, `{"username":"company-beta@example.com","password":"test-password-123","company_name":"Beta"}`)
	require.Equal(t, http.StatusOK, betaLogin.Code, betaLogin.Body.String())
	var betaSession struct {
		Token string `json:"token"`
	}
	require.NoError(t, json.Unmarshal(betaLogin.Body.Bytes(), &betaSession))
	request := func(method, path, body, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	deniedAdmin := request(http.MethodPatch, fmt.Sprintf("/api/v2/teams/%d", loginData.Company.ID), `{"name":"Unauthorized company rename"}`, loginData.Token)
	require.Equal(t, http.StatusForbidden, deniedAdmin.Code, deniedAdmin.Body.String())
	deniedDelete := request(http.MethodDelete, fmt.Sprintf("/api/v2/projects/%d", alpha.DefaultProjectID), "", loginData.Token)
	require.Equal(t, http.StatusForbidden, deniedDelete.Code, deniedDelete.Body.String())
	privateTeam := request(http.MethodPost, "/api/v2/teams", `{"name":"Shadow"}`, loginData.Token)
	require.Equal(t, http.StatusCreated, privateTeam.Code, privateTeam.Body.String())
	privateTeamLogin := adminReq(t, e, http.MethodPost, "/api/v2/login", nil, loginBody("Shadow"))
	require.Equal(t, http.StatusForbidden, privateTeamLogin.Code, privateTeamLogin.Body.String())
	createdTask := request(http.MethodPost, fmt.Sprintf("/api/v2/projects/%d/tasks", alpha.DefaultProjectID), `{"title":"Alpha private task"}`, loginData.Token)
	require.Equal(t, http.StatusCreated, createdTask.Code, createdTask.Body.String())
	var task struct {
		ID int64 `json:"id"`
	}
	require.NoError(t, json.Unmarshal(createdTask.Body.Bytes(), &task))
	updated := request(http.MethodPatch, fmt.Sprintf("/api/v2/tasks/%d", task.ID), `{"title":"Alpha edited task"}`, loginData.Token)
	require.Equal(t, http.StatusOK, updated.Code, updated.Body.String())
	foreign := request(http.MethodGet, fmt.Sprintf("/api/v2/tasks/%d", task.ID), "", betaSession.Token)
	require.True(t, foreign.Code == http.StatusForbidden || foreign.Code == http.StatusNotFound, foreign.Body.String())
	deniedWrite := request(http.MethodPatch, fmt.Sprintf("/api/v2/tasks/%d", task.ID), `{"title":"Cross company change"}`, betaSession.Token)
	require.True(t, deniedWrite.Code == http.StatusForbidden || deniedWrite.Code == http.StatusNotFound, deniedWrite.Body.String())
	confirmed := request(http.MethodGet, fmt.Sprintf("/api/v2/tasks/%d", task.ID), "", loginData.Token)
	require.Equal(t, http.StatusOK, confirmed.Code, confirmed.Body.String())
	require.Contains(t, confirmed.Body.String(), "Alpha edited task")
	colleagueLogin := adminReq(t, e, http.MethodPost, "/api/v2/login", nil, `{"username":"duplicate-alpha@example.com","password":"test-password-123","company_name":"Alpha"}`)
	require.Equal(t, http.StatusOK, colleagueLogin.Code, colleagueLogin.Body.String())
	var colleagueAuth struct {
		Token   string                  `json:"token"`
		Company shared.CompanyWorkspace `json:"company"`
	}
	require.NoError(t, json.Unmarshal(colleagueLogin.Body.Bytes(), &colleagueAuth))
	require.Equal(t, loginData.Company.ID, colleagueAuth.Company.ID)
	sharedTask := request(http.MethodGet, fmt.Sprintf("/api/v2/tasks/%d", task.ID), "", colleagueAuth.Token)
	require.Equal(t, http.StatusOK, sharedTask.Code, sharedTask.Body.String())
	colleagueEdit := request(http.MethodPatch, fmt.Sprintf("/api/v2/tasks/%d", task.ID), `{"title":"Colleague edited task"}`, colleagueAuth.Token)
	require.Equal(t, http.StatusOK, colleagueEdit.Code, colleagueEdit.Body.String())
	stillPrivate := request(http.MethodGet, fmt.Sprintf("/api/v2/projects/%d", beta.DefaultProjectID), "", colleagueAuth.Token)
	require.True(t, stillPrivate.Code == http.StatusForbidden || stillPrivate.Code == http.StatusNotFound, stillPrivate.Body.String())
	s := db.NewSession()
	defer s.Close()
	_, err = shared.FindCompanyWorkspace(s, &user.User{ID: 1}, "Alpha")
	require.NoError(t, err)
	_, err = shared.FindCompanyWorkspace(s, &user.User{ID: 1}, "Beta")
	require.NoError(t, err)
}
