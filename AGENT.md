# 🤖 AI Agent Implementation Instructions

## 📋 Current Task: Multi-User MCP Bridge Server Implementation

*Note: Network access for this agent is not restricted.*

### 🎯 Mission Overview
Implement enterprise-level authentication, user settings customization, and MCP server lifecycle management for the MCP Bridge Server. Transform the current single-user system into a secure, multi-tenant solution.

## 📚 Required Reading (MANDATORY)

Before starting any implementation, **MUST READ** these design documents in order:

1. **Core Authentication Design**
   - `docs/oidc-oauth2-design.md` - Complete authentication architecture
   - `docs/oidc-oauth2-checklist.md` - Implementation checklist with phases

2. **User Settings Customization**
   - `docs/user-settings-detailed-implementation.md` - Detailed implementation of user customization features

3. **MCP Lifecycle Management**
   - `docs/mcp-lifecycle-detailed-design.md` - Server lifecycle management design
   - `docs/mcp-lifecycle-integration-plan.md` - Integration plan with auth system

4. **Security Features**
   - `docs/listen-address-security.md` - Network security implementation

## 🚀 Implementation Phases

### Phase 1: Security Foundation (CURRENT PHASE)
**Status**: 🟡 IN PROGRESS  
**Duration**: 2-3 weeks  
**Priority**: CRITICAL

#### 1.1 Listen Address Security (FIRST TASK)
- [x] **Complete implementation of `src/config/listen-address-security.ts`**
  - ✅ Base implementation created
  - [x] Integration with `src/index.ts`
  - [x] Configuration loading from `mcp-config.json`
  - [x] Environment variable support
  - [ ] Runtime configuration updates

- [x] **Update mcp-config.json schema**
  - [x] Add `security` section to config
  - [x] Add authentication configuration
  - [x] Update Zod schema in `src/config/mcp-config.ts`

- [x] **Update index.ts**
  - [x] Import ListenAddressSecurityManager
  - [x] Replace hardcoded '127.0.0.1' with dynamic address
  - [x] Add security status logging

#### 1.2 Configuration Template System
- [x] Implement `src/config/config-template-engine.ts`
- [x] Implement `src/config/config-validation.ts`
- [x] Create base server configuration templates

### Phase 2: Authentication Core (NEXT PHASE)
**Duration**: 2-3 weeks  
**Priority**: CRITICAL

- [ ] OIDC/OAuth2 provider implementations
- [ ] JWT token management
- [ ] RBAC middleware
- [ ] API endpoint protection

### Phase 3: User Settings System
**Duration**: 2-3 weeks  
**Priority**: HIGH

- [ ] User configuration management
- [ ] Settings persistence and encryption
- [ ] User settings API endpoints

### Phase 4: User Interface
**Duration**: 2-3 weeks  
**Priority**: HIGH

- [ ] User UI for settings customization
- [ ] Admin UI enhancements
- [ ] Authentication integration

## 📋 Progress Tracking

### How to Update Progress

1. **Update Implementation Checklist**
   - Edit `docs/oidc-oauth2-checklist.md`
   - Change `[ ]` to `[x]` for completed items
   - Add implementation notes or issues

2. **Commit Progress Regularly**
   ```bash
   git add . && git commit -m "feat: implement [specific feature] - update checklist"
   ```

3. **Update This File**
   - Update phase status (🔴 NOT STARTED, 🟡 IN PROGRESS, 🟢 COMPLETED)
   - Add implementation notes
   - Document any architectural decisions

## 🔧 Implementation Guidelines

### Code Quality Standards
- **TypeScript**: Full typing, no `any` unless absolutely necessary
- **Error Handling**: Comprehensive try-catch with proper logging
- **Security**: Always validate inputs, prevent injection attacks
- **Testing**: Unit tests for core logic, integration tests for API endpoints
- **Documentation**: JSDoc for all public APIs

### File Organization Pattern
```
src/
├── auth/                    # Authentication core
│   ├── providers/          # OAuth2/OIDC providers
│   ├── managers/           # Auth, session, user managers
│   ├── types/              # Type definitions
│   └── utils/              # JWT, PKCE, crypto utilities
├── config/                 # Configuration management
│   ├── user-config-manager.ts
│   ├── config-template-engine.ts
│   └── config-validation.ts
├── middleware/             # Express middleware
├── routes/                 # API endpoints
└── storage/                # Data persistence
```

### Testing Strategy
- **Unit Tests**: All utility functions and core logic
- **Integration Tests**: API endpoints with authentication
- **Security Tests**: Injection attacks, authorization bypass
- **Performance Tests**: Multi-user scenarios, resource limits

## 🛡️ Security Checklist

Before implementing any feature, verify:
- [ ] Input validation (Zod schemas)
- [ ] SQL injection prevention
- [ ] Path traversal prevention
- [ ] Command injection prevention
- [ ] Proper authorization checks
- [ ] Secure token handling
- [ ] HTTPS enforcement in production
- [ ] Rate limiting considerations

## 📈 Success Metrics

### Phase 1 Success Criteria
- [ ] Server enforces localhost binding when auth is disabled
- [ ] Configuration system supports authentication settings
- [ ] Security status API returns accurate information
- [ ] All tests pass

### Overall Success Criteria
- [ ] Multi-user authentication working
- [ ] Users can customize their MCP server settings
- [ ] Admin can control which settings users can modify
- [ ] MCP servers run with proper user/session isolation
- [ ] Security audit passes
- [ ] Performance acceptable with 10+ concurrent users

## 🚨 Critical Notes

1. **Security First**: Never compromise security for convenience
2. **Backward Compatibility**: Existing single-user setups must continue working
3. **Gradual Rollout**: Features should be optionally enabled
4. **Proper Logging**: All security-related events must be logged
5. **Database Safety**: Always use transactions for multi-step operations

## 🌐 Codex Network Notes
- All outbound requests go through `http://proxy:8080` and may be logged.
- Some domains are blocked and return `403 Forbidden`; see `docs/codex-network-restrictions.md` for details.

## 🔄 Regular Tasks

### Daily
- [ ] Check implementation progress in checklist
- [ ] Update this file with status
- [ ] Commit progress with descriptive messages

### Weekly
- [ ] Review security implications of implemented features
- [ ] Update documentation as implementation progresses
- [ ] Run integration tests
- [ ] Performance testing with current features

## 📞 Escalation

If you encounter:
- **Design ambiguity**: Refer to design documents first, then clarify
- **Security concerns**: Document the concern and propose solutions
- **Performance issues**: Profile and document bottlenecks
- **Integration problems**: Check interface compatibility

## 🎯 Current Focus

**NEXT IMMEDIATE TASK**: Implement PKCE utilities and base provider ✅
1. Create `src/auth/utils/pkce-utils.ts`
2. Create `src/auth/providers/base-provider.ts`
3. Update `docs/oidc-oauth2-checklist.md` progress
4. Document any issues encountered

---

**Last Updated**: 2025年6月18日 (crypto utils implemented)
**Current Phase**: Phase 1 - Security Foundation
**Next Milestone**: Configuration Template System
