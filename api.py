from openai import OpenAI

class chat_api:
    def __init__(self, api_name, api_version, api_url):
        self.api_name = api_name
        self.api_version = api_version
        self.api_url = api_url
        self.ask_client = OpenAI(api_key=api_url).response.create

    def askDefinition(self, word):
        return (self.client(model="gpt-4o-mini", prompt=f"What is the definition of this {word}?. Give a concise answer.")).output_text
    
    def askCuriculum(self, prompt):
        return (self.client(model="gpt-4o-mini", prompt=f"Create a curiculum to learn about {prompt}. Give me a step by step learning plan from the very fundamental to fully understand.")).output_text
    
    def askSpecific(self, prompt):
        return (self.client(model="gpt-4o-mini", prompt=prompt)).output_text
    
    def findTopic(self, text, subject):
        # The return format should be [topic, explanation]
        response = (self.client(model="gpt-4o-mini", prompt=f"Find the main topic of this text: {text}. Narrow it down to a singular main topic and explained why it related to {subject}. Your answer should be just the word that define the topic at first and then a comma and then the explaination that why it is related to said topic. Make the explaination short")).output_text
        return response.split(", ", 1)