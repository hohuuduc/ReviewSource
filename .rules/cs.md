## Critical
1. No hard-coded secrets
Description: Do not hard-code secrets or connection strings in the code
Target Object: String literals, configuration values

2. Memory management
Description: Must use 'using' or Dispose for IDisposable objects
Target Object: IDisposable implementations, Stream, SqlConnection

3. Async naming convention
Description: Async methods must end with 'Async' and return Task
Target Object: Async methods, Task-returning methods

## Warning
1. No generic exception catching
Description: Avoid catching generic Exception, use specific exception types
Target Object: catch blocks, Exception handling

2. Null check required
Description: Null check required before usage of nullable objects
Target Object: Nullable references, method parameters

3. Avoid magic numbers
Description: Avoid magic numbers; use named constants instead
Target Object: Numeric literals, hard-coded values

4. Method length limit
Description: Maximum 30 lines per method for readability
Target Object: Method bodies, function definitions

5. Naming conventions
Description: PascalCase for public members, camelCase for private members
Target Object: Class members, fields, properties, methods

6. Dependency Injection
Description: Use Dependency Injection over direct instantiation with 'new'
Target Object: Object creation, class constructors

7. XML documentation
Description: XML comments required for public APIs
Target Object: Public classes, methods, properties