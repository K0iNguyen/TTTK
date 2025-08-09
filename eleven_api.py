from elevenlabs.client import ElevenLabs

class voice_api:
    def __init__(self, api_url):
        self.ask_client = ElevenLabs(api_key=api_url)

    def transcribe(self, audio_file):
        audio = open(audio_file, "rb")
        response = self.ask_client.speech_to_text.convert(model_id="scribe_v1", file=audio)
        return response.text if response else "Transcription failed"