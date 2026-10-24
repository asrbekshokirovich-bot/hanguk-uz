"""Tests for the browser 'Copy as cURL' importer."""

from __future__ import annotations

from uzum_scraper.curl_import import parse_curl

CHROME_CURL = r"""
curl 'https://graphql.uzum.uz/' \
  -H 'accept: application/json' \
  -H 'accept-language: uz-UZ,uz;q=0.9,ru;q=0.8' \
  -H 'authorization: Bearer eyJHEADER.eyJBODY.sig' \
  -H 'content-type: application/json' \
  -H 'x-iid: 2b87b332-1c5e-40d3-866c-2a6cc98676e7' \
  --data-raw '{"operationName":"getMakeSearch","variables":{}}'
"""


def test_parse_chrome_curl():
    auth = parse_curl(CHROME_CURL)
    assert auth.ok
    assert auth.auth_token == "eyJHEADER.eyJBODY.sig"
    assert auth.iid == "2b87b332-1c5e-40d3-866c-2a6cc98676e7"
    assert auth.language == "uz-UZ"


def test_parse_curl_header_equals_form():
    cmd = 'curl https://graphql.uzum.uz/ --header="authorization: Bearer TOKENXYZ"'
    auth = parse_curl(cmd)
    assert auth.auth_token == "TOKENXYZ"


def test_parse_curl_missing_auth():
    auth = parse_curl("curl https://uzum.uz/ -H 'accept: application/json'")
    assert not auth.ok
    assert auth.auth_token == ""


def test_parse_curl_double_quotes_and_bearer_case():
    cmd = 'curl "https://graphql.uzum.uz/" -H "Authorization: bearer ABC.DEF"'
    auth = parse_curl(cmd)
    assert auth.auth_token == "ABC.DEF"
