# Inkwell – Blog Platform with Comments

A full-stack blogging platform where users can register, log in, write posts and discuss them in comments.

## Features
- User registration, login and JWT authentication (passwords hashed with bcrypt)
- Create, edit and delete blog posts (only the author can modify a post)
- Comment section on every post (delete your own comment, or any comment on your post)
- RESTful API backed by a SQLite database
- Responsive single-page frontend (vanilla JS, light/dark mode)

## Tech stack
Node.js · Express · SQLite (built-in node:sqlite) · JWT · bcryptjs · HTML/CSS/JavaScript

## Getting started
```bash
git clone <your-repo-url>
cd blog-platform
npm install
cp .env.example .env     # then set JWT_SECRET to a long random string
npm start
```
Open http://localhost:3000. Requires Node.js 22.13 or newer.

## API
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create an account |
| POST | `/api/auth/login` | – | Log in, returns a token |
| GET | `/api/auth/me` | ✔ | Current user |
| GET | `/api/posts` | – | List posts |
| GET | `/api/posts/:id` | – | Get one post |
| POST | `/api/posts` | ✔ | Create a post |
| PUT | `/api/posts/:id` | ✔ owner | Update a post |
| DELETE | `/api/posts/:id` | ✔ owner | Delete a post |
| GET | `/api/posts/:id/comments` | – | List comments |
| POST | `/api/posts/:id/comments` | ✔ | Add a comment |
| DELETE | `/api/comments/:id` | ✔ | Delete a comment (author or post owner) |

Send the token as `Authorization: Bearer <token>`.

## Project structure
```
server.js          Express app entry
db.js              SQLite connection and schema
middleware/auth.js JWT sign / verify
routes/auth.js     Register, login
routes/posts.js    Posts and comments
public/            Frontend (index.html, style.css, app.js)
```

## Deploying
Works on Render (a `render.yaml` is included) or any Node 22+ host. Set `JWT_SECRET` as an environment variable. SQLite stores data in a local file, so on free hosting the data resets on redeploy; use a persistent disk or a hosted database for permanent data.
