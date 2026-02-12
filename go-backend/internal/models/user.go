package models

import "time"

type User struct {
	ID          int64
	Username    string
	Email       string
	Password    string
	DisplayName    string
	HasAssessment  int    // 0: No, 1: Yes
	Stage          int    // 1: Stage 1, 2: Stage 2, 3: Stage 3
	CreatedAt      time.Time
	UpdatedAt   time.Time
}
