"""
* tests/unit/test_signals.py
? Unit tests for the Signal and SignalManager classes.
  No database required.
"""

import pytest

from backbone.core.signals import Signal, SignalManager


class FakeModel:
    pass


class AnotherModel:
    pass


@pytest.mark.asyncio
class TestSignal:
    async def test_connected_async_handler_is_called_on_emit(self):
        signal = Signal("test_signal")
        calls = []

        async def handler(instance, **kwargs):
            calls.append(instance)

        signal.connect(FakeModel)(handler)
        fake_instance = FakeModel()
        await signal.emit(fake_instance)

        assert len(calls) == 1
        assert calls[0] is fake_instance

    async def test_sync_handler_is_called_on_emit(self):
        signal = Signal("test_signal")
        calls = []

        def sync_handler(instance, **kwargs):
            calls.append(instance)

        signal.connect(FakeModel)(sync_handler)
        await signal.emit(FakeModel())

        assert len(calls) == 1

    async def test_handler_receives_kwargs(self):
        signal = Signal("test_signal")
        received_kwargs = {}

        async def handler(instance, **kwargs):
            received_kwargs.update(kwargs)

        signal.connect(FakeModel)(handler)
        await signal.emit(FakeModel(), changed_fields={"status": ("old", "new")})

        assert "changed_fields" in received_kwargs
        assert received_kwargs["changed_fields"] == {"status": ("old", "new")}

    async def test_handler_for_different_model_is_not_called(self):
        signal = Signal("test_signal")
        calls = []

        async def handler(instance, **kwargs):
            calls.append(instance)

        signal.connect(AnotherModel)(handler)
        await signal.emit(FakeModel())

        assert len(calls) == 0

    async def test_multiple_handlers_are_all_called(self):
        signal = Signal("test_signal")
        call_log = []

        async def handler_one(instance, **kwargs):
            call_log.append("one")

        async def handler_two(instance, **kwargs):
            call_log.append("two")

        signal.connect(FakeModel)(handler_one)
        signal.connect(FakeModel)(handler_two)
        await signal.emit(FakeModel())

        assert set(call_log) == {"one", "two"}

    async def test_disconnecting_handler_stops_calls(self):
        signal = Signal("test_signal")
        calls = []

        async def handler(instance, **kwargs):
            calls.append(1)

        signal.connect(FakeModel)(handler)
        signal.disconnect(FakeModel, handler)
        await signal.emit(FakeModel())

        assert len(calls) == 0

    async def test_duplicate_connect_does_not_call_handler_twice(self):
        signal = Signal("test_signal")
        calls = []

        async def handler(instance, **kwargs):
            calls.append(1)

        signal.connect(FakeModel)(handler)
        signal.connect(FakeModel)(handler)  # duplicate
        await signal.emit(FakeModel())

        assert len(calls) == 1

    async def test_failing_async_handler_does_not_raise_in_caller(self):
        signal = Signal("test_signal")

        async def broken_handler(instance, **kwargs):
            raise RuntimeError("Handler failure!")

        signal.connect(FakeModel)(broken_handler)
        # ? Should NOT raise — errors are caught and logged
        await signal.emit(FakeModel())


class TestSignalManager:
    def test_signal_manager_has_all_expected_signals(self):
        manager = SignalManager()
        assert hasattr(manager, "post_create")
        assert hasattr(manager, "post_update")
        assert hasattr(manager, "post_delete")
        assert hasattr(manager, "on_field_change")

    def test_each_signal_is_distinct(self):
        manager = SignalManager()
        signals = [
            manager.post_create,
            manager.post_update,
            manager.post_delete,
            manager.on_field_change,
        ]
        assert len(set(id(s) for s in signals)) == 4
