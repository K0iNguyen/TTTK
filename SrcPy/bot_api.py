from openai import OpenAI

class chat_api:
    def __init__(self, api_url):
        self.ask_client = OpenAI(api_key=api_url).responses.create

    def askDefinition(self, word):
        return (self.ask_client(model="gpt-4o-mini", input=f"What is the definition of this {word}?. Give a concise answer.")).output_text
    
    def askCuriculum(self, prompt, file_path):
        file = open(file_path, "w")
        file.write((self.ask_client(model="gpt-4o-mini", input=f"Create a curiculum to learn about {prompt}. Give me a step by step learning plan from the very fundamental to fully understand.")).output_text)
        file.close()

    def askSpecific(self, prompt):
        return (self.ask_client(model="gpt-4o-mini", input=prompt)).output_text
    
    def findTopic(self, text, subject):
        # The return format should be [topic, explanation]
        response = (self.ask_client(model="gpt-4o-mini", input=f"Find the main topic of this text: {text}. Narrow it down to a singular main topic and explained why it related to {subject}. Your answer should be just the word that define the topic at first and then a comma and then the explaination that why it is related to said topic. Make the explaination short")).output_text
        return response.split(", ", 1)
    
    def determineMood(self, text):
        response = (self.ask_client(model="gpt-4o-mini", input=f"Determine the mood of this text: {text}. Your answer should be just the mood word.")).output_text
        return response
    
    def followupQuestion(self, old_text, question):
        response = (self.ask_client(model="gpt-4o-mini", input=f"Continue this conversation {old_text}, answer this question: {question}.")).output_text
        return response
    