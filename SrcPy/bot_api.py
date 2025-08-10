from openai import OpenAI

class chat_api:
    def __init__(self, api_key):
        self.client = OpenAI(api_key=api_key)

    def askDefinition(self, word):
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": f"What is the definition of this {word}? Give a concise answer."}]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error getting definition: {str(e)}"
    
    def askCurriculum(self, prompt, file_path):
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": f"Create a curriculum to learn about {prompt}. Give me a step by step learning plan from the very fundamental to fully understand."}]
            )
            with open(file_path, "w", encoding='utf-8') as file:
                file.write(response.choices[0].message.content)
        except Exception as e:
            with open(file_path, "w", encoding='utf-8') as file:
                file.write(f"Error creating curriculum: {str(e)}")

    def askSpecific(self, prompt):
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"I apologize, but I encountered an error: {str(e)}"
    
    def findTopic(self, text, subject):
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": f"Find the main topic of this text: {text}. Narrow it down to a singular main topic and explain why it's related to {subject}. Your answer should be just the word that defines the topic at first and then a comma and then the explanation of why it is related to said topic. Make the explanation short."}]
            )
            result = response.choices[0].message.content
            return result.split(", ", 1) if ", " in result else [result, ""]
        except Exception as e:
            return ["Error", f"Error finding topic: {str(e)}"]
    
    def determineMood(self, text):
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": f"Determine the mood of this text: {text}. Your answer should be just the mood word."}]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return f"Error: {str(e)}"