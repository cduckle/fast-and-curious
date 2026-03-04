import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import app


def test_index_route_returns_200():
    client = app.app.test_client()
    response = client.get("/")
    assert response.status_code == 200


def test_image_missing_query_returns_400():
    client = app.app.test_client()
    response = client.get("/api/image")
    assert response.status_code == 400
    assert response.get_json() == {"error": "missing_query"}


def test_image_missing_api_key_returns_503(monkeypatch):
    def fake_fetch_google_image(_query):
        return None, "missing_api_key"

    monkeypatch.setattr(app, "fetch_google_image", fake_fetch_google_image)
    client = app.app.test_client()
    response = client.get("/api/image?query=ford%20focus")
    assert response.status_code == 503
    assert response.get_json() == {"error": "missing_api_key"}
