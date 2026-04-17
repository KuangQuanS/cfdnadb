# cfdnadb

cfdnadb 是一个基于 cfDNA 的研究数据库项目，主要由以下部分组成：

1. 后端：Spring Boot（打包为 WAR）
2. 前端：React + Vite
3. 查询数据引擎：DuckDB

## 项目结构

1. `backend`：Spring Boot 后端，构建产物为 `cfdnadb.war`
2. `frontend`：Vite 前端应用
3. `.github/workflows/build-war.yml`：CI/CD 工作流（自动构建与部署）
4. `start-backend.cmd`：Windows 本地后端启动脚本
5. `start-frontend.cmd`：Windows 本地前端启动脚本

## 本地调试（Windows）

### 前置条件

1. 已安装 Java 11+
2. 已安装 Node.js，并且 `npm` 可在命令行使用
3. `backend/mvnw.cmd` 可用

### 启动后端

1. 在仓库根目录执行 `start-backend.cmd`
2. 脚本默认会注入本地 DuckDB 调试参数：
   `APP_DATA_DIR` = 仓库根目录
   `APP_QUERY_DB_FILE` = `cfdnadb.duckdb`
   `APP_TCGA_IGV_FILE` = 仓库根目录下的 `tcga_maf.txt`

### 启动前端

1. 在仓库根目录执行 `start-frontend.cmd`
2. 默认启动在 `127.0.0.1:5173`

### 本地 DuckDB 数据

1. 将 `cfdnadb.duckdb` 放在仓库根目录（当前仓库已存在）
2. 如果要调试相关功能，请确保仓库根目录存在 `tcga_maf.txt`

## 当前部署流程

1. 推送到 `master` 或 `main`
2. GitHub Actions 构建后端 WAR
3. self-hosted Linux runner 执行部署，将 WAR 替换到 Tomcat `webapps`
4. 替换前会先备份旧 WAR

## 配置说明

1. 当前项目是“默认值 + 环境变量覆盖”模式
2. 若服务器数据路径不变，通常仅替换 WAR 即可
3. 若路径变化，请在运行机器上设置以下变量：
   `APP_DATA_DIR`
   `APP_QUERY_DB_FILE`
   `APP_TCGA_IGV_FILE`

## 常见问题排查

1. 后端启动报错 `DuckDB file not found`：
   检查 `APP_DATA_DIR` 与 `APP_QUERY_DB_FILE` 是否正确
2. 后端启动报错 `npm EPERM`（例如 `esbuild.exe` 无法 unlink）：
   关闭占用 `frontend/node_modules` 的进程（前端 dev server、编辑器相关进程、杀毒扫描）后重试
3. 前端启动报错 `npm not found`：
   安装 Node.js 后重开终端
4. 部署 job 失败：
   检查 runner 标签、目录写权限、Tomcat `webapps` 路径是否正确