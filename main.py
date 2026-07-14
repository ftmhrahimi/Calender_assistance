"""FastAPI entry point exposing the calendar assistant over HTTP.

Exposes a single ``POST /insert`` endpoint that accepts a raw
natural-language event request in the request body and delegates the
event-creation pipeline to the processing module.

Run with::

    uvicorn main:app --reload
"""

from fastapi import FastAPI, Body
import Combinev4
import new_version1

app = FastAPI()

@app.post("/insert")
async def your_function(req: str = Body(...)):
    """Create a Google Calendar event from a natural-language request.

    Args:
        req: Free-form event description sent as the request body.

    Returns:
        The result of the event-creation pipeline.
    """
    #result = Combinev4.main(req)
    result = new_version1.main(req)
    return result
