from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Khushi Website Backend")

@app.get("/")
def read_root():
    return {"message": "Hello World from FastAPI Backend!"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
