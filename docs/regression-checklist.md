# Regression Checklist

Lightweight checks to run before and after large refactors.

## Baseline Run (2026-05-09)

- [x] Run `npm run lint` to capture current static-analysis status.
- [ ] Credentials login flow works (`/login` + NextAuth credentials callback).
- [ ] Google OAuth sign-in flow works.
- [ ] Register flow works (`/register`).
- [ ] Dashboard loads for authenticated users.
- [ ] Summary view loads and primary interactions work.

## Notes

- Baseline lint currently reports one existing error in `app/components/ThemeProvider.jsx` and multiple existing warnings unrelated to this refactor batch.
- Manual browser flow checks should be repeated after each high-risk phase.
