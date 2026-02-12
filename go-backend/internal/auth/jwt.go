package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type TokenSigner struct {
	Secret     string
	Expiration time.Duration
}

func NewTokenSigner(secret string, expirationMillis int64) *TokenSigner {
	if expirationMillis <= 0 {
		expirationMillis = 86400000
	}
	return &TokenSigner{
		Secret:     secret,
		Expiration: time.Duration(expirationMillis) * time.Millisecond,
	}
}

func (t *TokenSigner) Generate(username string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": username,
		"iat": now.Unix(),
		"exp": now.Add(t.Expiration).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(t.Secret))
}

func (t *TokenSigner) Validate(tokenStr string) bool {
	if tokenStr == "" {
		return false
	}
	_, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return []byte(t.Secret), nil
	})
	return err == nil
}

func (t *TokenSigner) ParseUsername(tokenStr string) (string, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return []byte(t.Secret), nil
	})
	if err != nil {
		return "", err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if sub, ok := claims["sub"].(string); ok {
			return sub, nil
		}
	}
	return "", jwt.ErrSignatureInvalid
}
