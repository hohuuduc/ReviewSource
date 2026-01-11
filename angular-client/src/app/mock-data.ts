import { ReviewResult } from "./services/ollama.service";

export const data: ReviewResult = {
    "issues": [
        {
            "line": 10,
            "object": "connString",
            "type": "Critical",
            "violated_rule": "Do not hard-code secrets or connection strings in the code",
            "suggested_change": "Move the connection string to a configuration file or environment variable and read it at runtime instead of hard‑coding it."
        },
        {
            "line": 12,
            "object": "void",
            "type": "Critical",
            "violated_rule": "Async methods must end with 'Async' and return Task",
            "suggested_change": "Rename the method to ProcessDataAsync and change its signature to\n\n```csharp\npublic async Task ProcessDataAsync(string filePath, string data)\n```\nthen await any asynchronous calls inside."
        },
        {
            "line": 17,
            "object": "stream",
            "type": "Critical",
            "violated_rule": "Must use 'using' or Dispose for IDisposable objects",
            "suggested_change": "Wrap the FileStream in a using statement:\n\n```csharp\nusing (var stream = new FileStream(filePath, FileMode.Open))\n{\n    // work with stream\n}\n```"
        },
        {
            "line": 57,
            "object": "Exception",
            "type": "Warning",
            "violated_rule": "Avoid catching generic Exception, use specific exception types",
            "suggested_change": "Catch specific exceptions such as IOException, FileNotFoundException, etc. For example:\n\n```csharp\ncatch (IOException ex)\n{\n    Console.WriteLine(ex.Message);\n}\n```"
        },
        {
            "line": 21,
            "object": "100",
            "type": "Warning",
            "violated_rule": "Avoid magic numbers; use named constants instead",
            "suggested_change": "Define a named constant:\n\n```csharp\nconst int MaxDataLength = 100;\nif (length > MaxDataLength) { /* ... */ }\n```"
        },
        {
            "line": 23,
            "object": "0.08",
            "type": "Warning",
            "violated_rule": "Avoid magic numbers; use named constants instead",
            "suggested_change": "Define a named constant:\n\n```csharp\nconst decimal TaxRate = 0.08m;\nvar tax = length * TaxRate;\n```"
        },
        {
            "line": 12,
            "object": "process_data",
            "type": "Warning",
            "violated_rule": "PascalCase for public members, camelCase for private members",
            "suggested_change": "Rename the method to ProcessData (or ProcessDataAsync if making async)."
        },
        {
            "line": 9,
            "object": "CurrentRate",
            "type": "Warning",
            "violated_rule": "PascalCase for public members, camelCase for private members",
            "suggested_change": "Rename the private field to currentRate (camelCase)."
        },
        {
            "line": 14,
            "object": "logger",
            "type": "Warning",
            "violated_rule": "Use Dependency Injection over direct instantiation with 'new'",
            "suggested_change": "Inject an ILogger implementation via constructor:\n\n```csharp\nprivate readonly ILogger _logger;\npublic DataProcessor(ILogger logger) { _logger = logger; }\n```"
        },
        {
            "line": 7,
            "object": "DataProcessor",
            "type": "Warning",
            "violated_rule": "XML comments required for public APIs",
            "suggested_change": "Add XML documentation comments above the class declaration, e.g.:\n\n```csharp\n/// <summary>\n/// Processes data files.\n/// </summary>\npublic class DataProcessor { /* ... */ }\n```"
        },
        {
            "line": 64,
            "object": "Logger",
            "type": "Warning",
            "violated_rule": "XML comments required for public APIs",
            "suggested_change": "Add XML documentation comments above the Logger class and its public members."
        },
        {
            "line": 12,
            "object": "process_data",
            "type": "Critical",
            "violated_rule": "Max 30 lines per method",
            "suggested_change": "Refactor the method into smaller, focused methods (e.g., ReadFileAsync, ValidateData, CalculateTax, LogResults) to keep each method under 30 lines."
        }
    ]
}