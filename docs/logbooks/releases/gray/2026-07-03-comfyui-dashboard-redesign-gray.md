# 2026-07-03 ComfyUI Dashboard Redesign Gray Release

## Release Info

- **Release Name**: `20260703-comfyui-dashboard-redesign-gray-r1-v0522`
- **Environment**: gray
- **Branch**: `xinghuan-integration-clean`
- **Commit**: `5f96e8d` - feat: redesign comfyui admin dashboard with instance pool management
- **Version**: `0.5.22`
- **Release Time**: 2026-07-03 11:40:23

## Changes

### ComfyUI Admin Dashboard Redesign

**Frontend Refactor**:
- New `admin-comfyui-overview.tsx`: Dashboard overview page
  - Metrics cards: total instances, online/offline stats, shared workflows count
  - Instance grid with health indicators, connection info, capability tags
  - Test connection button with real-time latency, GPU/VRAM, queue status
- New `admin-comfyui-detail.tsx`: Instance detail page
  - Config tab: instance name, Base URL, Tailscale address, concurrency, capabilities
  - Workflows tab: create drafts, upload JSON, edit parameters, push to shared area
  - Logs tab: placeholder for future implementation
- Modified `admin-comfyui-instances-panel.tsx`: router component between overview and detail
- Complete CSS styles: metric-card, instance-grid, detail-header, tabs, etc.

**Backend Enhancement**:
- New `POST /api/admin/comfyui/instances/:id/test-connection` API
  - Concurrent requests to ComfyUI `/system_stats` and `/queue` endpoints
  - Returns latency, GPU info (name, VRAM total/free), queue status (running/pending tasks)
  - 10-second timeout and error handling
- Extended `ComfyuiConnectionTestResult` type definition

**Deployment Config**:
- Added `XINGHUAN_COMFYUI_CONNECTOR_TOKEN` to `config/.env.example`

**Documentation**:
- Updated `docs/prd/v0.1.0/progress.md` with completion status
- Updated `docs/logbooks/daily/2026/2026-07/2026-07-03.md` work log

## Deployment Steps

```bash
# On gray server (canvas-next.hhh2121.xyz)
cd /opt/apps/xinghuan-canvas-next

# Create release directory
sudo mkdir -p 20260703-comfyui-dashboard-redesign-gray-r1-v0522
cd 20260703-comfyui-dashboard-redesign-gray-r1-v0522

# Clone and checkout
sudo git clone https://github.com/Hhh2178/xinghuan.git .
sudo git checkout 5f96e8d

# Install dependencies
sudo npm ci

# Build
sudo npm run build:single-port

# Verify build
ls -la apps/api/dist/
ls -la apps/web/dist/
ls -la apps/admin/dist/
ls -la apps/worker/dist/

# Copy environment file
sudo cp /opt/apps/xinghuan-canvas-next/shared/canvas-next.env .env

# Add XINGHUAN_COMFYUI_CONNECTOR_TOKEN to .env if not exists
# sudo nano .env
# XINGHUAN_COMFYUI_CONNECTOR_TOKEN=<shared-secret-token>

# Run migrations (if any)
sudo npm run db:migrate

# Switch symlink
cd /opt/apps/xinghuan-canvas-next
sudo rm current
sudo ln -s 20260703-comfyui-dashboard-redesign-gray-r1-v0522 current

# Restart services
sudo systemctl restart xinghuan-canvas-next
sudo systemctl restart xinghuan-canvas-next-worker

# Verify services
sudo systemctl status xinghuan-canvas-next
sudo systemctl status xinghuan-canvas-next-worker

# Check version
curl -fsS http://127.0.0.1:18200/api/status | jq
```

## Verification Checklist

### Server Local Verification
- [ ] `npm ci` completes successfully (0 vulnerabilities)
- [ ] `npm run build:single-port` completes successfully
- [ ] `systemctl is-active xinghuan-canvas-next` returns `active`
- [ ] `systemctl is-active xinghuan-canvas-next-worker` returns `active`
- [ ] `curl http://127.0.0.1:18200/api/status` returns `version=0.5.22`, `environment=gray`
- [ ] `npm run verify:single-port` passes

### Public HTTPS Verification
- [ ] `https://canvas-next.hhh2121.xyz/` loads successfully
- [ ] `https://canvas-next.hhh2121.xyz/admin` loads successfully
- [ ] `https://canvas-next.hhh2121.xyz/api/status` returns correct version
- [ ] Admin login works
- [ ] Navigate to ComfyUI Instances panel

### ComfyUI Dashboard Verification
- [ ] Overview page renders with metrics cards
- [ ] Instance grid displays all registered instances
- [ ] Instance cards show health status indicators (online/offline/degraded)
- [ ] "Test Connection" button works and displays latency/GPU/queue info
- [ ] "Manage" button navigates to detail page
- [ ] Detail page renders with three tabs (Config/Workflows/Logs)
- [ ] Config tab allows editing instance settings
- [ ] Workflows tab displays workflow list and creation form
- [ ] "Back to Instance Pool" button returns to overview
- [ ] No console errors in browser developer tools

### Optional: Real ComfyUI Connection Test
- [ ] Deploy comfyui-connector on a ComfyUI machine
- [ ] Configure `XINGHUAN_COMFYUI_CONNECTOR_TOKEN` and other env vars
- [ ] Start connector: `npm run dev -w @xinghuan/comfyui-connector`
- [ ] Verify instance appears in admin dashboard
- [ ] Test connection shows real GPU/VRAM stats
- [ ] Upload Z-image workflow JSON
- [ ] Create workflow draft and push to shared area

## Rollback Plan

If issues occur:

```bash
cd /opt/apps/xinghuan-canvas-next
sudo rm current
sudo ln -s 20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522 current
sudo systemctl restart xinghuan-canvas-next
sudo systemctl restart xinghuan-canvas-next-worker
```

## Notes

- This release focuses on admin dashboard UX improvements
- Backend connector mechanism remains unchanged from previous release
- Real ComfyUI connection testing requires separate machine setup
- `XINGHUAN_COMFYUI_CONNECTOR_TOKEN` must be set in server .env file
