import { TestBed } from '@angular/core/testing';
import { TokenDecoderService } from './token-decoder.service';

describe('TokenDecoderService', () => {
  let service: TokenDecoderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenDecoderService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getStudentId', () => {
    it('should return null when no token exists', () => {
      const result = service.getStudentId();
      expect(result).toBeNull();
    });

    it('should extract student_id from valid token', () => {
      const mockPayload = {
        sub: 'user-123',
        student_id: 'student-456',
        email: 'test@example.com',
        role: 'student'
      };
      
      const mockToken = createMockJWT(mockPayload);
      localStorage.setItem('auth_token', mockToken);

      const result = service.getStudentId();
      expect(result).toBe('student-456');
    });

    it('should fallback to sub when student_id is not present', () => {
      const mockPayload = {
        sub: 'user-789',
        email: 'test@example.com',
        role: 'student'
      };
      
      const mockToken = createMockJWT(mockPayload);
      localStorage.setItem('auth_token', mockToken);

      const result = service.getStudentId();
      expect(result).toBe('user-789');
    });

    it('should return null for invalid token format', () => {
      localStorage.setItem('auth_token', 'invalid-token');

      const result = service.getStudentId();
      expect(result).toBeNull();
    });

    it('should return null for malformed JWT', () => {
      localStorage.setItem('auth_token', 'header.invalid-payload.signature');

      const result = service.getStudentId();
      expect(result).toBeNull();
    });
  });
});

/**
 * Helper function to create a mock JWT token for testing
 */
function createMockJWT(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'mock-signature';
  
  return `${header}.${encodedPayload}.${signature}`;
}
