import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar, NavLink } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-features-layout',
  imports: [Navbar, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class Layout {
  readonly title = 'UAGRM Academic';
  readonly icon = 'auto_stories';
  readonly navLinks: ReadonlyArray<NavLink> = [
    { label: 'Inscripcion', path: '/dashboard/enrollment', exact: true },
    { label: 'Dashboard', path: '/dashboard/dashboard' }
  ];
}
