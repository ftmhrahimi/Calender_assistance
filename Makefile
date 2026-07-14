# Calendar Assistance — convenience commands

VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

.PHONY: help install run api clean

help:  ## Show available commands
	@echo "Calendar Assistance — available commands:"
	@echo "  make install   Create virtualenv and install dependencies"
	@echo "  make run       Run the interactive CLI"
	@echo "  make api       Run the FastAPI server (uvicorn)"
	@echo "  make clean     Remove caches and build artifacts"

install:  ## Create virtualenv and install dependencies
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

run:  ## Run the interactive CLI
	$(PYTHON) Combinev_org.py

api:  ## Run the FastAPI server
	$(VENV)/bin/uvicorn main:app --reload

clean:  ## Remove caches and build artifacts
	rm -rf __pycache__ */__pycache__ .pytest_cache build dist *.egg-info
