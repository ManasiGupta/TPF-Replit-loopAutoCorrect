import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("loop_api.main:app", host="0.0.0.0", port=int(os.environ["PORT"]), access_log=False)
