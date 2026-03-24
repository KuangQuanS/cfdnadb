# Deployment Guide

This project is now prepared as a single Tomcat application:
- backend API and frontend static files are packaged into one `war`
- deploy one file: `cfdnadb.war`
- public URL: `https://leelab.kmmu.edu.cn/cfdnadb/`

## 1. Build the single WAR

Requirements:
- JDK 21
- Maven
- Node.js 20+
- npm

Build command:

```powershell
cd D:\OneDrive\website\cfdnadb\backend
mvn package
```

What happens during build:
- Maven runs `npm ci` in `frontend/`
- Maven runs the Vite production build with base path `/cfdnadb/`
- frontend `dist/` is copied into backend static resources
- backend and frontend are packaged together as one WAR

Build output:
- `backend/target/cfdnadb.war`

## 2. Deploy to Tomcat

Tomcat requirement:
- Tomcat 10.1.x or newer

Deployment steps:
1. Stop Tomcat
2. Copy `backend/target/cfdnadb.war` into Tomcat `webapps/`
3. Start Tomcat

Tomcat will expand it as the `/cfdnadb` context.

Resulting URLs:
- Frontend: `https://leelab.kmmu.edu.cn/cfdnadb/`
- API: `https://leelab.kmmu.edu.cn/cfdnadb/api/v1/...`
- Swagger UI: `https://leelab.kmmu.edu.cn/cfdnadb/swagger-ui.html`

## 3. Nginx reverse proxy example

If Nginx is in front of Tomcat, you no longer need separate frontend and backend rules. Proxy the whole app context:

```nginx
server {
    listen 443 ssl http2;
    server_name leelab.kmmu.edu.cn;

    location /cfdnadb/ {
        proxy_pass http://127.0.0.1:8080/cfdnadb/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

This works because the Spring Boot app now serves:
- frontend static files
- SPA route fallback to `index.html`
- backend `/api/**` endpoints

all from the same WAR.

## 4. Production configuration

Recommended environment variables for Tomcat or `setenv.sh` / `setenv.bat`:

```text
DB_URL=jdbc:postgresql://your-host:5432/cfdnadb
DB_USERNAME=your_user
DB_PASSWORD=your_password
CORS_ALLOWED_ORIGINS=https://leelab.kmmu.edu.cn
```

Notes:
- if no database variables are provided, the current scaffold still starts with the demo H2 datasource
- same-origin deployment means CORS matters much less, but the setting is harmless to keep
- do not expose internal storage paths, mount points or server names in public API responses

## 5. Practical summary

Build:
- run `mvn package` in `backend/`

Upload:
- copy `backend/target/cfdnadb.war` to Tomcat `webapps/`

Serve:
- Tomcat hosts `/cfdnadb`
- Nginx optionally proxies `/cfdnadb/` to Tomcat

That is the full deployment path.
