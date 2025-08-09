from bot_api import chat_api
from eleven_api import voice_api

def main():
    # api_key = open(r"..\.venv\bot_api_key", "r")

    # # Initialize the chat API with dummy parameters
    # bot_api = chat_api(api_name="ChatAPI", api_version="1.0", api_url=api_key.read().strip())
    # api_key.close()

    # # Example usage of the chat API
    # print(bot_api.askDefinition("Python"))  # Get definition of a word
    # bot_api.askCuriculum("Machine Learning", "curriculum.md")  # Get curriculum for a topic
    # print(bot_api.askSpecific("What is the capital of France?"))  # Ask a specific question
    # print(bot_api.findTopic("The quick brown fox jumps over the lazy dog.", "animals"))  # Find topic in a text
    # print(bot_api.determineMood("I am feeling great today!"))  # Determine mood of a text 

    api_key = open(r"..\.venv\voice_api_key", "r")
    voice_api_instance = voice_api(api_url=api_key.read().strip())
    api_key.close()

    response = voice_api_instance.transcribe(r"..\Callrecording.m4a")
    print(response)  # Transcribe an audio file

main()

# JavaScript Function
# function sendAudioToBackend(audioBlob) {
#   const formData = new FormData();
#   formData.append('audio', audioBlob, 'recording.webm');

#   fetch('http://localhost:5000/upload', {
#     method: 'POST',
#     body: formData
#   })
#   .then(response => response.json())
#   .then(data => {
#     // handle response from backend
#     console.log('Backend response:', data);
#   })
#   .catch(error => {
#     console.error('Error sending audio:', error);
#   });
# }