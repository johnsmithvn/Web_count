# Production Security Checklist

## 🚀 Before Deployment

### 1. Environment Variables
```bash
# Required
export NODE_ENV=production
export JWT_SECRET="your-super-secure-random-string-here"

# Optional
export MAX_LOGIN_ATTEMPTS=5
export LOGIN_LOCKOUT_TIME=900000  # 15 minutes
```

### 2. Server Configuration
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure firewall (only allow necessary ports)
- [ ] Set up reverse proxy (nginx/apache)
- [ ] Enable rate limiting
- [ ] Configure CORS properly

### 3. Database Security
- [ ] Move database outside web directory
- [ ] Set proper file permissions (600)
- [ ] Enable database encryption if needed
- [ ] Regular backups with encryption

### 4. Application Security
- [ ] Strong admin password (auto-generated)
- [ ] Password complexity enforced
- [ ] Session timeout configuration
- [ ] Log monitoring setup

### 5. Infrastructure Security
- [ ] Server hardening
- [ ] Regular security updates
- [ ] Intrusion detection system
- [ ] Fail2ban or similar for brute force protection

## 🔒 Production vs Development

| Feature | Development | Production |
|---------|-------------|------------|
| Password | 3+ chars | 8+ complex |
| JWT Secret | Default | Environment var |
| HTTPS | Optional | Required |
| Rate Limiting | Disabled | Enabled |
| Logging | Console | File + monitoring |

## 🚨 Additional Considerations

### Network Security
- Use VPN for admin access
- IP whitelist for sensitive operations  
- Geographic restrictions if needed

### Monitoring
- Failed login attempts
- Unusual access patterns
- Database size changes
- Server resource usage

### Backup Strategy
- Automated daily backups
- Encrypted backup storage
- Recovery testing
- Offsite backup copies
