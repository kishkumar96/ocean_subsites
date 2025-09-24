# COG Tiler Port Configuration Fix

## Problem Identified
The COG tiler was configured to run on port 8000, which was already in use by a Django application (`/home/kishank/DCRP-Training-Database/django-dcrp-training/dcrp-env/bin/python manage.py runserver 0.0.0.0:8000`).

## Resolution
Changed the COG tiler to run on **port 8001** to avoid the port conflict.

## Changes Made

### 1. Updated COG Tiler Command Configuration
**File**: `/home/kishank/cog_tiler/cog_tiler/commands.txt`
```diff
- uvicorn main:app --reload
+ uvicorn main:app --reload --port 8001
```

### 2. Updated Widget5 Configuration
**File**: `/home/kishank/ocean_subsites/plugin/widget5/src/pages/Home.jsx`
```diff
- baseUrl: "http://localhost:8000/cog",
+ baseUrl: "http://localhost:8001/cog",
```

### 3. Updated Docker Configuration  
**File**: `/home/kishank/cog_tiler/cog_tiler/docker-compose.yml`
```diff
- "8084:8000"
+ "8001:8000"
```

## Current Service Status

### Port Allocation
- **Port 8000**: Django DCRP Training Application (existing)
- **Port 8001**: COG Tiler Service ✅ 
- **Port 3000**: Widget5 React Application ✅

### Service Commands
```bash
# Start COG Tiler (port 8001)
cd /home/kishank/cog_tiler/cog_tiler
source cog_env/bin/activate
uvicorn main:app --reload --port 8001

# Start Widget5 (port 3000)  
cd /home/kishank/ocean_subsites/plugin/widget5
npm start
```

### Verification Tests
✅ COG Service Root: `http://localhost:8001/cog/`
✅ COG Service Docs: `http://localhost:8001/cog/docs`  
✅ COG Tile Generation: Working (tested with dynamic tile endpoint)
✅ Widget5 Application: `http://localhost:3000`
✅ No Port Conflicts: All services running on separate ports

## Integration Status
- **COG Tiler**: Running on port 8001 with virtual environment
- **Widget5**: Updated to use port 8001 for COG service calls
- **Port Conflict**: Resolved - no more "port already in use" errors
- **Service Communication**: COG tiles can be generated on-demand
- **Fallback Logic**: WMS fallback still available for reliability

## Next Steps
1. Test COG layer selection in Widget5 interface
2. Verify tile loading performance vs WMS
3. Monitor memory usage during tile generation
4. Consider production deployment with reverse proxy

The port conflict has been resolved and both services can now run simultaneously without interference.