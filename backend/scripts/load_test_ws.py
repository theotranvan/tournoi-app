"""Load test: simulate N concurrent WebSocket connections on a tournament.

Usage:
    python scripts/load_test_ws.py ws://localhost:8000/ws/tournaments/demo/ 200

Before a live tournament, run this to validate the server can handle
the expected number of simultaneous spectators.
"""

import asyncio
import sys
import time

import websockets


async def one_client(url: str, i: int) -> tuple[int, int]:
    async with websockets.connect(url) as ws:
        await ws.recv()  # welcome / initial state
        count = 0
        start = time.time()
        try:
            while time.time() - start < 60:
                await asyncio.wait_for(ws.recv(), timeout=2)
                count += 1
        except asyncio.TimeoutError:
            pass
        return i, count


async def main(url: str, n: int) -> None:
    print(f"Connecting {n} clients to {url}...")
    tasks = [one_client(url, i) for i in range(n)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    ok = [r for r in results if not isinstance(r, Exception)]
    errors = [r for r in results if isinstance(r, Exception)]
    total_events = sum(c for _, c in ok)
    print(f"OK: {len(ok)}/{n}, errors: {len(errors)}, total events received: {total_events}")
    if errors:
        for e in errors[:5]:
            print(f"  ERROR: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/load_test_ws.py <ws_url> <num_clients>")
        print("Example: python scripts/load_test_ws.py ws://localhost:8000/ws/tournaments/demo/ 200")
        sys.exit(1)
    url = sys.argv[1]
    n = int(sys.argv[2])
    asyncio.run(main(url, n))
