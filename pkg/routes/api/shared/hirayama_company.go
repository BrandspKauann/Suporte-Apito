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

package shared

import (
	"strings"
	"unicode/utf8"

	"code.vikunja.io/api/pkg/models"
	"code.vikunja.io/api/pkg/modules/hirayama"
	"code.vikunja.io/api/pkg/user"
	"xorm.io/xorm"
)

const CompanyDescription = "Empresa da Central de Suporte"

type CompanyWorkspace struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	ProjectIDs []int64 `json:"project_ids"`
}

// An approved signup code authorizes enrollment into the named company.
func CreateCompanyWorkspace(s *xorm.Session, owner *user.User, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 250 {
		return models.ErrInvalidData{Message: "Informe o nome da empresa (até 250 caracteres)."}
	}
	supportID, err := hirayama.SupportUserID()
	if err != nil {
		return err
	}
	team := &models.Team{}
	exists, err := s.Where("LOWER(name) = ? AND created_by_id = ?", strings.ToLower(name), supportID).Get(team)
	if err != nil {
		return err
	}
	support, err := user.GetUserByID(s, supportID)
	if err != nil {
		return err
	}
	if !exists {
		team = &models.Team{Name: name, Description: CompanyDescription, IsPublic: false}
		if err := team.Create(s, support); err != nil {
			return err
		}
	}
	links := []*models.TeamProject{}
	if err := s.Where("team_id = ?", team.ID).OrderBy("project_id").Find(&links); err != nil {
		return err
	}
	if len(links) == 0 {
		project := &models.Project{Title: name, Description: "Projetos e chamados da empresa."}
		if err := project.Create(s, support); err != nil {
			return err
		}
		link := &models.TeamProject{TeamID: team.ID, ProjectID: project.ID, Permission: models.PermissionWrite}
		if err := link.Create(s, support); err != nil {
			return err
		}
		links = append(links, link)
	}
	if supportID != owner.ID {
		member := &models.TeamMember{TeamID: team.ID, Username: owner.Username, Admin: false}
		if err := member.Create(s, support); err != nil {
			return err
		}
	}
	owner.DefaultProjectID = links[0].ProjectID
	_, err = s.ID(owner.ID).Cols("default_project_id").Update(owner)
	return err
}

func FindCompanyWorkspace(s *xorm.Session, account *user.User, name string) (*CompanyWorkspace, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, models.ErrInvalidData{Message: "Informe a empresa que deseja acessar."}
	}
	supportID, err := hirayama.SupportUserID()
	if err != nil {
		return nil, err
	}
	teams := []*models.Team{}
	err = s.Table("teams").Join("INNER", "team_members", "team_members.team_id = teams.id").
		Where("team_members.user_id = ? AND LOWER(teams.name) = ? AND teams.created_by_id = ?", account.ID, strings.ToLower(name), supportID).
		Select("teams.*").Find(&teams)
	if err != nil {
		return nil, err
	}
	if len(teams) != 1 {
		return nil, models.ErrGenericForbidden{}
	}
	links := []*models.TeamProject{}
	if err := s.Where("team_id = ?", teams[0].ID).OrderBy("project_id").Find(&links); err != nil {
		return nil, err
	}
	workspace := &CompanyWorkspace{ID: teams[0].ID, Name: teams[0].Name, ProjectIDs: []int64{}}
	for _, link := range links {
		workspace.ProjectIDs = append(workspace.ProjectIDs, link.ProjectID)
	}
	return workspace, nil
}
