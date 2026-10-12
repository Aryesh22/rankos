# Lesson 8 — Tools of the Trade

> **Goal:** get comfortable with the four tools every developer touches daily:
> the terminal, npm, environment variables, and git.

## 1. The terminal

The terminal runs programs by typing their names instead of clicking icons.
It looks intimidating; it's actually just very literal. The ~8 commands you need:

```bash
pwd                         # "print working directory" — where am I?
ls                          # list files here
cd backend                  # change directory (move into a folder)
cd ..                       # move UP one folder
mkdir notes                 # make a folder
cat package.json            # print a file's contents
node src/index.js           # run a JS file with Node
# Press Ctrl+C to stop a running program. Tab autocompletes names. ↑ repeats history.
```

Commands act on the folder you're *in* — most "command not found"/"no such file"
errors are really "you're in the wrong folder." `pwd` first, always.

## 2. npm — the package manager

Nobody writes everything from scratch. Your backend stands on packages —
express, mongoose, bcrypt… — downloaded from the npm registry.

- `package.json` — the shopping list (and scripts). You read the backend's in
  Lesson 3.
- `node_modules/` — the actual downloaded packages. Huge, disposable,
  regenerable — never edit it, never commit it to git.
- `package-lock.json` — records *exact* versions so every machine installs
  identical code.

```bash
npm install            # download everything in package.json → node_modules/
npm install dayjs      # add a new package (also updates package.json)
npm run dev            # run the "dev" script defined in package.json
npm test               # run the "test" script
```

(Your frontend also has `bun.lock` — Bun is an alternative to npm; same concepts.)

## 3. Environment variables & `.env`

Code needs settings that differ per machine (database URL) or must stay secret
(JWT secret, SMS API key). These never go in code — they go in **environment
variables**, loaded from a `.env` file:

```bash
# backend/.env  (example)
PORT=8080
MONGODB_URI=mongodb://localhost:27017/rankos
JWT_ACCESS_SECRET=some-long-random-string
```

`backend/src/config/env.js` reads these (via the `dotenv` package), applies
defaults, and exports one tidy `env` object the rest of the app imports.
`.env` is listed in `.gitignore` so secrets never enter git. Typically a
`.env.example` file (committed, secrets blanked) documents what's needed.

**Rule: if it's a secret and it's in a code file, that's a bug.**

## 4. git — the time machine

**git** records snapshots ("commits") of your project so you can see history,
undo mistakes, and collaborate without overwriting each other. (Your `myapp`
folder isn't a git repository yet — worth fixing; ask Claude to set it up.)

The mental model:

```
working files  →  git add  →  staging area  →  git commit  →  permanent history
```

```bash
git init                        # start tracking a folder (once)
git status                      # what changed? (run this constantly)
git add -A                      # stage all changes for the next snapshot
git commit -m "Add task lesson" # take the snapshot, with a message
git log --oneline               # view history
git diff                        # see exactly what you changed
```

**Branches** let you build a feature on a side-track, then merge it into the
main line when ready:

```bash
git switch -c fix-auth     # create + switch to a branch
# ...work, add, commit...
git switch main            # go back
git merge fix-auth         # bring the work in
```

**GitHub** is a website that hosts git repositories online — for backup, sharing,
and code review (`git push` uploads, `git pull` downloads). git = the tool,
GitHub = a home for it.

## 5. Honorable mentions (recognize the names)

- **ESLint / Prettier** (`npm run lint` / `format`) — auto-check and auto-format
  code style. Both configured in your project.
- **nodemon** — what `npm run dev` uses: restarts the backend automatically on
  every file save.
- **Vite** — the frontend's dev server & bundler (`npm run dev` in
  `rankos-ai-mentor/`): serves the app instantly and updates the browser as you
  save (hot reload).
- **Docker** — packages an app + its whole environment into a portable box
  (see `docker:*` scripts). Skip for now; know the name.
- **Swagger** — auto-generated, browsable API docs. Your backend serves them at
  `/api/docs` when enabled.

---

## ✏️ Exercises

1. In a terminal: `cd` into `myapp`, then into `backend`, run `pwd`, `ls`, and
   `cat package.json`. Find the `dev` script — what command does it actually run?
2. Why must `node_modules/` never be committed to git if `package.json` +
   `package-lock.json` are? (Hint: what can regenerate it?)
3. Name two things in this project that belong in `.env` and would be dangerous
   inside a code file.
4. **Do it for real:** ask Claude Code to `git init` this project and make the
   first commit — then run `git log` and `git status` yourself to see the result.

**Next:** [Lesson 9 — Running & Deploying](09-running-and-deploying.md)
