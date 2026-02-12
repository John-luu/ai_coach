package models

import "time"

type User struct {
	ID          int64
	Username    string
	Email       string
	Password    string
	DisplayName    string
	HasAssessment  int    // 0: No, 1: Yes
	CreatedAt      time.Time
	UpdatedAt   time.Time
}
