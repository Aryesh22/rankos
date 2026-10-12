# Glossary — Every Jargon Word in One Place

Sorted alphabetically. **L#** = the lesson that explains it properly.

| Term | Plain-English meaning | L# |
|---|---|---|
| **API** | The "menu" of requests a server accepts | 1 |
| **Access token** | Short-lived JWT sent with every request to prove who you are | 6 |
| **`async` / `await`** | JS keywords for "this takes time; pause here until it's done" | 2 |
| **Authentication** | Proving who you are (login) | 6 |
| **Authorization** | What you're allowed to do (roles/permissions) | 6 |
| **Backend** | The server half of an app; users never see it directly | 1 |
| **bcrypt** | Slow one-way password scrambler used before storing passwords | 6 |
| **Branch (git)** | A side-track of history for building a feature safely | 8 |
| **Client** | Any program that sends requests (browser, phone app, `curl`) | 1 |
| **Collection** | A "drawer" of documents in MongoDB (e.g. `users`) | 5 |
| **Commit (git)** | One saved snapshot of the project, with a message | 8 |
| **Component (React)** | A reusable UI piece written as a function returning markup | 7 |
| **Controller** | Layer that unpacks a request, calls a service, sends the response | 4 |
| **CORS** | Browser rule controlling which websites may call your API | 4 |
| **`curl`** | Terminal tool for making HTTP requests by hand | 1 |
| **Database** | A program whose job is storing data permanently and finding it fast | 5 |
| **Dependency** | A package your code uses (listed in `package.json`) | 8 |
| **Deployment** | Running your app on an always-on internet-reachable computer | 9 |
| **Document** | One record in MongoDB (JSON-shaped), e.g. one user | 5 |
| **Docker** | Packages an app + environment into a portable, identical-everywhere box | 9 |
| **Endpoint** | One item on the API menu: a verb + path, e.g. `POST /tasks` | 1 |
| **Environment variable** | A setting/secret provided from outside the code (`.env`) | 8 |
| **Express** | The Node.js framework your backend is built on (routing, middleware) | 4 |
| **Frontend** | The user-facing half of an app (screens, buttons) | 1 |
| **git** | Version control: records history, enables undo and collaboration | 8 |
| **GitHub** | Website that hosts git repositories online | 8 |
| **Health check** | Endpoint that answers "is the server alive?" for humans and platforms | 9 |
| **Hook (React)** | A `use...` function giving components powers (state, data fetching) | 7 |
| **Hot reload** | Dev servers updating the running app the moment you save | 8 |
| **HTTP** | The universal request/response format of the web | 1 |
| **Index (database)** | Pre-built lookup table making queries on a field fast | 5 |
| **JSON** | The `{ "label": value }` text format data travels in | 1 |
| **JSX / TSX** | HTML-like syntax inside JavaScript/TypeScript (React files) | 7 |
| **JWT** | Signed token proving identity; can't be forged without the server's secret | 6 |
| **localhost** | "This same computer" — where apps run during development | 1 |
| **Middleware** | Checkpoint functions every request passes through (auth, parsing, limits) | 4 |
| **Model** | Code describing a data shape + giving DB methods (`User.find(...)`) | 5 |
| **MongoDB** | Your app's database; stores JSON-like documents | 5 |
| **Mongoose** | The JS library your backend uses to talk to MongoDB with schemas | 5 |
| **Node.js** | The program that runs JavaScript outside the browser (your backend) | 2 |
| **npm** | Installs packages and runs project scripts (`npm install`, `npm run dev`) | 8 |
| **OTP** | One-time password — short-lived code sent by SMS/email | 6 |
| **Package** | Reusable code downloaded from the npm registry | 8 |
| **Port** | Numbered "door" on a computer; your backend listens on 8080 | 1 |
| **Props (React)** | Data passed into a component from its parent | 7 |
| **Rate limiting** | Blocking clients that make too many requests (bouncer) | 4 |
| **React** | UI library: declare "UI = f(data)", it re-renders when data changes | 7 |
| **React Query** | Library that fetches/caches server data for components | 7 |
| **Redis** | Fast in-memory store for short-lived data (caches, counters, queues) | 5 |
| **Refresh token** | Long-lived, revocable token used to mint new access tokens | 6 |
| **Request / Response** | The question a client sends / the answer a server returns | 1 |
| **REST** | The convention of using HTTP verbs + paths as an API style | 1 |
| **Route** | Mapping from verb+path to handler function | 4 |
| **Salt** | Random extra input making every password hash unique | 6 |
| **Schema** | The declared shape/rules of a document (fields, types, required) | 5 |
| **Server** | A program that answers requests; also the machine it runs on | 1 |
| **Service (backend layer)** | Where business rules live; knows nothing about HTTP | 4 |
| **Soft delete** | Marking a record deleted (`deletedAt`) instead of erasing it | 5 |
| **State (React)** | A component's changing data; changing it re-renders the UI | 7 |
| **Stateless** | HTTP remembers nothing between requests — hence tokens | 6 |
| **Status code** | 3-digit result: 2xx ok, 4xx asker's fault, 5xx server's fault | 1 |
| **Swagger** | Auto-generated browsable API documentation | 8 |
| **Tailwind CSS** | Styling via tiny utility classes (`flex gap-2 p-4`) | 7 |
| **Terminal** | Text interface for running programs by name | 8 |
| **Token** | A string the client holds as proof of login (the "wristband") | 6 |
| **TypeScript** | JavaScript + type labels, checked before running (`.ts`/`.tsx`) | 2 |
| **Vite** | Tool that serves the frontend in dev and bundles it for production | 8 |
