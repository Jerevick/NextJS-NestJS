# SAML development (WP-1.4)

## Configure institution

Store SAML IdP settings on `Institution.settings` (encrypted):

```json
{
  "ssoProvider": "SAML",
  "saml": { "_enc": true, "v": 1, "payload": "..." }
}
```

Use `SamlAuthService.upsertSamlConfig` from an admin script or future settings API.

Required fields: `entryPoint`, `issuer`, `idpCert` (PEM).

## Endpoints

| Method | Path                                   | Purpose                                            |
| ------ | -------------------------------------- | -------------------------------------------------- |
| GET    | `/auth/saml/metadata?institution=slug` | SP metadata XML                                    |
| GET    | `/auth/saml/login?institution=slug`    | Redirect to IdP                                    |
| POST   | `/auth/saml/acs`                       | Assertion consumer (RelayState = institution slug) |

Set `API_PUBLIC_URL` for correct callback URLs. Set `WEB_APP_URL` for post-login redirect.

## Local test

1. Use [samltest.id](https://samltest.id/) or a Docker IdP.
2. Configure institution slug + user email matching SAML NameID.
3. Open `http://localhost:4000/auth/saml/login?institution=your-slug`.
