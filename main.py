from fastapi import FastAPI, Body
import Combinev4
import new_version1

app = FastAPI()

@app.post("/insert")
async def your_function(req: str = Body(...)):
    #result = Combinev4.main(req)
    result = new_version1.main(req)
    return result