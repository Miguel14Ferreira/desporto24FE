# Pestana review — safe auth & contact quick wins (20 October 2026)

The 20-Oct Miguel Pestana review reports missing form method attributes, long registration and login usability issues. This change is intentionally limited to those that are confirmed and low-risk.

**Confirmed in code:** Angular login, registration and contact already invoke HttpClient POST, so the report's claim that existing authentication credentials are normally submitted using GET is not proven. However, the browser-native fallback for an HTML form with no method defaults to GET. These three forms now declare method="post"; Angular ngSubmit still owns actual requests and novalidate keeps the existing localized component validation.

Changes: required attributes, existing PT/EN hint text for username/password/age >=18, show/hide password control inside its input with aria-controls and aria-pressed. Create account button no longer silently disables when terms unchecked: submitting still invokes existing required-consent validation and blocks the API call until consent is accepted. Three Jasmine regression tests added.

**Not changed:** backend HTTP auth contracts, MFA, Google sign-in, email confirmation, invitation returns, database, deployment, password rules, CORS, CSP, login rate-limits, CSRF/origin protections or contact spam rate-limits. Further research required for those items. Tests authored, NOT run. PR is draft only; no merge or deploy. Run Angular build/tests and manual desktop browser E2E tests before approval.
