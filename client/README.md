# Social Messenger client 0.3.0

Windows/Android source for the Social v0.3.0 server component. The compact buddy list, chat pane and turn sidebar are inspired by the interaction model of MSN Messenger and Xfire (not a copy of their artwork or branding).

Open the app, enter a LoopRD server origin, register an account or sign in using Social-owned credentials. There is no developer token field and no external OIDC provider. On a server without the `looprd-social` component, there is no local social-data store or automatic fallback. Contacts require consent before direct messages; use the + Add friend action. Your turns appear when games on this server expose the documented activity contract.

Sessions are memory-only and require re-login after restart; background Android push, account recovery, game invitations and group chat remain planned. `npm run test` runs the protocol suite, `npm run web:build` builds the Vite frontend when dependencies are installed, and native GitHub Actions build the app. The online portrait generator is pinned and updated through reviewable PRs.
