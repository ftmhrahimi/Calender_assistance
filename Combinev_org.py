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

# Suppress the specific LangChainDeprecationWarning
warnings.filterwarnings("ignore", category=DeprecationWarning, module='langchain_core')

# Constants
SCOPES = ["https://www.googleapis.com/auth/calendar"]
DEEPINFRA_API_TOKEN = 'WcKyuf5DlPMCyjtfRHFweP9j1Qc8Hie8'
MODEL_ID = "meta-llama/Llama-2-70b-chat-hf"
#MODEL_ID = "meta-llama/Meta-Llama-3.1-405B-Instruct"

def get_current_dates():
    today_gregorian = datetime.now()
    today_jalali = JalaliDate.today()
    return today_gregorian.strftime("%Y-%m-%d"), today_jalali.strftime("%Y-%m-%d")

def create_llm_chain():
    os.environ["DEEPINFRA_API_TOKEN"] = DEEPINFRA_API_TOKEN
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
    user_req = input('Type your request: ')
    response = llm_chain({'request': user_req})
    dict_match = re.search(r"({.*})", response['text'], re.DOTALL)
    if dict_match:
        return ast.literal_eval(dict_match.group(1))
    else:
        raise ValueError("Failed to extract dictionary from LLM response")

def create_event_dict(dict_obj):
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
    try:
        service = build("calendar", "v3", credentials=creds)
        event = service.events().insert(calendarId="primary", body=event).execute()
        print(f"Event created: {event.get('htmlLink')}")
    except HttpError as error:
        print(f"An error occurred: {error}")

def main():
    try:
        llm_chain = create_llm_chain()
        dict_obj = get_user_request(llm_chain)
        event = create_event_dict(dict_obj)
        creds = get_google_credentials()
        create_google_calendar_event(creds, event)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()