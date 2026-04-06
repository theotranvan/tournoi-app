from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/tournaments/(?P<slug>[\w-]+)/$", consumers.TournamentConsumer.as_asgi()),
    re_path(r"ws/matches/(?P<match_id>[\w-]+)/$", consumers.MatchConsumer.as_asgi()),
    re_path(r"ws/tasks/(?P<task_id>[\w-]+)/$", consumers.TaskProgressConsumer.as_asgi()),
]
