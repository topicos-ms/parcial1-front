import { Component, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { Login } from '../pages/login/login';
import { Register } from '../pages/register/register';

@Component({
  selector: 'app-launcher',
  imports: [MatTabsModule, MatIconModule, Login, Register],
  templateUrl: './launcher.html',
  styleUrl: './launcher.scss'
})
export class Launcher {
  selectedIndex = signal(0);

  switchToRegister(): void {
    this.selectedIndex.set(1);
  }

  switchToLogin(): void {
    this.selectedIndex.set(0);
  }
}
