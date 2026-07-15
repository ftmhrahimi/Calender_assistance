"""Calendar Assistance — AI-powered natural-language Google Calendar assistant.

This module implements the complete pipeline of the application:

1. Accept a free-form, natural-language event request from the user
   (supports both Gregorian and Persian/Jalali date references).
2. Send the request to a hosted LLM (DeepInfra, Llama 2 70B) through
   LangChain to extract structured event fields.
3. Parse the LLM response into a Python dictionary.
4. Authenticate with Google via OAuth 2.0 (token cached in ``token.json``).
5. Insert the event into the user's primary Google Calendar.

Run directly as a script for the interactive CLI experience::

    python Combinev_org.py
"""

import os
import re
import ast
import warnings
from datetime import datetime
from persiantools.jdatetime import JalaliDate
from langchain_community.llms import DeepInfra
from langchain_core.prompts import PromptTemplate
from langchain.chains import LLMChain
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Suppress the LangChainDeprecationWarning emitted by the legacy LLMChain API.
warnings.filterwarnings("ignore", category=DeprecationWarning, module='langchain_core')

# OAuth scope granting full read/write access to Google Calendar.
SCOPES = ["https://www.googleapis.com/auth/calendar"]
MODEL_ID = "meta-llama/Llama-2-70b-chat-hf"
#MODEL_ID = "meta-llama/Meta-Llama-3.1-405B-Instruct"

APP_NAME = "Calendar Assistance"
APP_VERSION = "1.0.0"


def print_banner():
    """Print the CLI startup banner with the project title and version."""
    print()
    print("=" * 58)
    print(f"  📅  {APP_NAME}  —  v{APP_VERSION}")
    print("  AI-powered natural-language Google Calendar events")
    print("=" * 58)
    print()


def get_current_dates():
    """Return today's date in both calendar systems.

    Returns:
        tuple[str, str]: Today's Gregorian date and Persian (Jalali) date,
        both formatted as ``YYYY-MM-DD``.
    """
    today_gregorian = datetime.now()
    today_jalali = JalaliDate.today()
    return today_gregorian.strftime("%Y-%m-%d"), today_jalali.strftime("%Y-%m-%d")


def create_llm_chain():
    """Build the LangChain LLM chain used for event extraction.

    Configures the DeepInfra-hosted Llama 2 model and embeds today's
    Gregorian and Jalali dates into the prompt so the model can resolve
    relative dates ("tomorrow") and convert Persian calendar dates.

    Returns:
        LLMChain: A chain that maps a raw user request to a dictionary-shaped
        string describing the event.
    """
    # The DeepInfra LangChain wrapper reads the token from the
    # DEEPINFRA_API_TOKEN environment variable. Fail fast with a clear
    # message if it has not been provided.
    if not os.environ.get("DEEPINFRA_API_TOKEN"):
        raise SystemExit(
            "Error: the DEEPINFRA_API_TOKEN environment variable is not set.\n"
            "Set it before running, e.g.:\n"
            "    export DEEPINFRA_API_TOKEN=your-deepinfra-api-token\n"
            "See .env.example and README.md for details."
        )
    llm = DeepInfra(model_id=MODEL_ID)
    gregorian_date, jalali_date = get_current_dates()

    template = f"""
    Today's Gregorian date: {gregorian_date}
    Today's Persian (Jalali) date: {jalali_date}

    Analyze the following request and extract the relevant information to create an event dictionary:
    Request: {{request}}
    Instructions:
    1. Extract all relevant information for the event, including (if present):
       - Summary (title of the event)
       - Location
       - Description (any additional details provided)
       - Start date and time of event
       - End date and time (assume 1-hour duration if only start time is given) of event
       - Attendees (email addresses if provided)
    2. For dates and times:
       - Convert relative dates (e.g., "tomorrow", "next Monday") to actual dates based on the current year.
       - Convert Persian (Jalali) date to Gregorian date with note the current year for this conversion.
       - for example in 2024, 28th Shahrivar is 18th Sep but in 2023, 28th Shahrivar is 19th sep, note to current year.
       - Always use the current year ({gregorian_date[:4]}) for this conversion.
       - Use the format "YYYY-MM-DDTHH:MM:SS+00:00" for dateTime.
       - Donot change time!
    3. If any field is not provided in the request, mark it as "not provided."
    4. Format the output as a Python dictionary string, including all fields and marking missing fields as "not provided."
    5. Your response must contain ONLY this dictionary string, with no additional text or explanations.

    Now, analyze the given request and provide ONLY the output in the specified format.
    """
    prompt = PromptTemplate.from_template(template)
    return LLMChain(prompt=prompt, llm=llm)


def get_user_request(llm_chain):
    """Prompt the user for an event request and extract structured data.

    Reads one line of input, runs it through the LLM chain, and parses the
    first ``{...}`` block in the response as a Python dictionary.

    Args:
        llm_chain (LLMChain): The extraction chain built by
            :func:`create_llm_chain`.

    Returns:
        dict: Event fields extracted by the LLM (summary, location, start,
        end, etc.).

    Raises:
        ValueError: If no dictionary could be found in the LLM response.
    """
    user_req = input('📝 Type your request: ')
    response = llm_chain({'request': user_req})
    dict_match = re.search(r"({.*})", response['text'], re.DOTALL)
    if dict_match:
        return ast.literal_eval(dict_match.group(1))
    else:
        raise ValueError("Failed to extract dictionary from LLM response")


def create_event_dict(dict_obj):
    """Convert LLM-extracted fields into a Google Calendar event body.

    Args:
        dict_obj (dict): Raw fields returned by :func:`get_user_request`.

    Returns:
        dict: Event resource in the format expected by the Google Calendar
        API ``events.insert`` endpoint, using the ``Asia/Tehran`` time zone.
    """
    return {
        'summary': dict_obj['summary'].title(),
        'location': dict_obj['location'].title(),
        #'attendees':dict_obj['attendees'].title(),
        'start': {
            'dateTime': dict_obj['start'],
            'timeZone': 'Asia/Tehran'
        },
        'end': {
            'dateTime': dict_obj['end'],
            'timeZone': 'Asia/Tehran'
        }
    }


def get_google_credentials():
    """Obtain valid Google OAuth 2.0 credentials.

    Loads cached credentials from ``token.json`` when available. Expired
    credentials are refreshed silently; otherwise a browser-based OAuth
    consent flow is launched using ``credentials.json``. The resulting
    token is written back to ``token.json`` for future runs.

    Returns:
        Credentials: Authorized Google API credentials.
    """
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    return creds


def create_google_calendar_event(creds, event):
    """Insert an event into the user's primary Google Calendar.

    Args:
        creds (Credentials): Authorized credentials from
            :func:`get_google_credentials`.
        event (dict): Event body produced by :func:`create_event_dict`.
    """
    try:
        service = build("calendar", "v3", credentials=creds)
        event = service.events().insert(calendarId="primary", body=event).execute()
        print(f"\n✅ Event created: {event.get('htmlLink')}\n")
    except HttpError as error:
        print(f"\n❌ An error occurred: {error}\n")


def main():
    """Run the full assistant pipeline: prompt → LLM → auth → calendar."""
    try:
        llm_chain = create_llm_chain()
        dict_obj = get_user_request(llm_chain)
        event = create_event_dict(dict_obj)
        creds = get_google_credentials()
        create_google_calendar_event(creds, event)
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}\n")


if __name__ == "__main__":
    print_banner()
    main()
