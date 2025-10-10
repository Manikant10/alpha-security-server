# 🤝 Contributing to Alpha Security Server

We love your input! We want to make contributing to Alpha Security Server as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## 🚀 Development Process

We use GitHub to sync code to and from. We use GitHub flow, so all code changes happen through pull requests.

### Pull Request Process

1. Fork the repository and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## 📋 Coding Standards

### Code Style
- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Follow existing patterns in the codebase

### Commit Messages
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
🐛 Fix authentication bug in user login

- Fixed token validation logic
- Added proper error handling
- Updated tests

Fixes #123
```

### JavaScript Standards
- Use ES6+ features where appropriate
- Prefer `const` over `let`, and `let` over `var`
- Use template literals for string interpolation
- Use arrow functions for simple functions

## 🧪 Testing

- Write tests for any new functionality
- Ensure existing tests pass
- Maintain test coverage above 80%

Run tests:
```bash
npm test
```

## 🐛 Bug Reports

Great Bug Reports tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## 🎯 Feature Requests

We track feature requests as GitHub issues. Create an issue and provide:

- **Is your feature request related to a problem?** A clear description of the problem
- **Describe the solution you'd like** A clear description of what you want to happen
- **Describe alternatives you've considered** Any alternative solutions or features
- **Additional context** Any other context or screenshots

## 🔄 Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy environment file: `cp .env.production .env`
4. Start development server: `npm run dev`

## 📝 Documentation

- Keep README.md updated
- Add JSDoc comments for functions
- Update API documentation when changing endpoints

## 🏷️ Issues and Labels

We use labels to help organize and identify issues:

- `bug` - Something isn't working
- `feature` - New feature or request
- `documentation` - Improvements or additions to documentation
- `security` - Security-related issues
- `performance` - Performance improvements
- `dependencies` - Dependency updates

## 📞 Getting Help

If you need help, you can:

- Check existing [issues](https://github.com/Manikant10/alpha-security-server/issues)
- Create a new issue with the `question` label
- Join our discussions

## 📜 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

### Our Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable behavior and are expected to take appropriate and fair corrective action in response to any instances of unacceptable behavior.

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license that covers the project (MIT License).

## 🙏 Recognition

Contributors will be recognized in:
- The README.md contributors section
- Release notes for significant contributions
- Our hall of fame (coming soon!)

---

Thank you for contributing to Alpha Security Server! 🛡️