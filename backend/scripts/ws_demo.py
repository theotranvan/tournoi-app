#!/usr/bin/env python
"""WebSocket demo client — connect to a tournament feed and print events.

Usage:
    python scripts/ws_demo.py <tournament-slug> [--token <jwt>] [--host localhost:8000]

Examples:
    python scripts/ws_demo.py tournoi-demo-2026
    python scripts/ws_demo.py tournoi-demo-2026 --token eyJ...
"""

import argparse
import asyncio
import json
import sys

try:
    import websockets
except ImportError:
    print("Install websockets first:  pip install websockets")
    sys.exit(1)


async def listen(uri: str):
    print(f"Connecting to {uri} ...")
    try:
        async with websockets.connect(uri) as ws:
            print("Connected! Waiting for events (Ctrl+C to quit)\n")
            async for raw in ws:
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    data = raw
                event = data.get("event", "?") if isinstance(data, dict) else "?"
                print(f"[{event}]  {json.dumps(data, indent=2, default=str)}\n")
    except websockets.exceptions.ConnectionClosed as exc:
        print(f"Connection closed: {exc}")
    except ConnectionRefusedError:
        print("Connection refused — is the server running?")


def main():
    parser = argparse.ArgumentParser(description="WS demo client for Kickoff tournaments")
    parser.add_argument("slug", help="Tournament slug to watch")
    parser.add_argument("--token", default="", help="JWT access token for auth")
    parser.add_argument("--host", default="localhost:8000", help="Server host:port")
    parser.add_argument("--task", default="", help="Watch a Celery task instead of a tournament")
    args = parser.parse_args()

    if args.task:
        path = f"ws/tasks/{args.task}/"
    else:
        path = f"ws/tournaments/{args.slug}/"

    qs = f"?token={args.token}" if args.token else ""
    uri = f"ws://{args.host}/{path}{qs}"

    try:
        asyncio.run(listen(uri))
    except KeyboardInterrupt:
        print("\nDisconnected.")


if __name__ == "__main__":
    main()
