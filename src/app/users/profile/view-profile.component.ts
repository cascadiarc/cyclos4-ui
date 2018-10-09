import { LatLngBounds } from '@agm/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, Injector, OnInit } from '@angular/core';
import { Address, PhoneKind, PhoneView, UserView } from 'app/api/models';
import { ContactsService, UsersService } from 'app/api/services';
import { ErrorStatus } from 'app/core/error-status';
import { MapsService } from 'app/core/maps.service';
import { HeadingAction } from 'app/shared/action';
import { ApiHelper } from 'app/shared/api-helper';
import { BasePageComponent } from 'app/shared/base-page.component';
import { fitBounds, labelAddresses } from 'app/shared/helper';
import { BehaviorSubject } from 'rxjs';

/**
 * Displays an user profile
 */
@Component({
  selector: 'view-profile',
  templateUrl: 'view-profile.component.html',
  styleUrls: ['view-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewProfileComponent extends BasePageComponent<UserView> implements OnInit {
  constructor(
    injector: Injector,
    private usersService: UsersService,
    private contactsService: ContactsService,
    public maps: MapsService) {
    super(injector);
  }

  key: string;
  locatedAddresses: Address[];
  mobilePhone: PhoneView;
  landLinePhone: PhoneView;
  mobilePhones: PhoneView[];
  landLinePhones: PhoneView[];

  addressMapFitBounds$ = new BehaviorSubject<LatLngBounds>(null);

  get user(): UserView {
    return this.data;
  }

  ngOnInit() {
    super.ngOnInit();
    this.key = this.route.snapshot.paramMap.get('key');
    if (this.key == null && this.login.user != null) {
      this.key = ApiHelper.SELF;
    }
    this.errorHandler.requestWithCustomErrorHandler(defaultHandling => {
      this.usersService.viewUser({ user: this.key })
        .subscribe(user => {
          this.data = user;
        }, (resp: HttpErrorResponse) => {
          if ([ErrorStatus.FORBIDDEN, ErrorStatus.UNAUTHORIZED].includes(resp.status)) {
            this.notification.error(this.i18n('You don\'t have permission to view the profile of this user'));
            this.data = {};
          } else {
            defaultHandling(resp);
          }
        });
    });
  }

  onDataInitialized(user: UserView) {
    // Get the located addresses
    if (this.maps.enabled) {
      this.locatedAddresses = labelAddresses(user.addresses, this.i18n);
    }

    // We'll show the phones either as single or multiple
    this.mobilePhones = user.phones.filter(p => p.type === PhoneKind.MOBILE);
    this.landLinePhones = user.phones.filter(p => p.type === PhoneKind.LAND_LINE);
    if (this.mobilePhones.length === 1) {
      this.mobilePhone = this.mobilePhones[0];
      this.mobilePhones = [];
    }
    if (this.landLinePhones.length === 1) {
      this.landLinePhone = this.landLinePhones[0];
      this.landLinePhones = [];
    }

    // Get the actions
    const actions: HeadingAction[] = [];
    const permissions = user.permissions || {};
    const contact = permissions.contact || {};
    const payment = permissions.payment || {};
    if ((this.login.user || {}).id === user.id && user.permissions.profile.editProfile) {
      actions.push(new HeadingAction(this.i18n('Edit'), () => {
        this.router.navigate(['users', 'my-profile', 'edit']);
      }, true));
    }
    if (contact.add) {
      actions.push(new HeadingAction(this.i18n('Add {{name}} to my contacts', {
        name: user.display
      }), () => {
        this.addContact();
      }));
    }
    if (contact.remove) {
      actions.push(new HeadingAction(this.i18n('Remove {{name}} from my contacts', {
        name: user.display
      }), () => {
        this.removeContact();
      }));
    }
    if (payment.userToUser) {
      actions.push(new HeadingAction(this.i18n('Pay {{name}}', {
        name: user.display
      }), () => {
        this.router.navigate(['/banking', 'payment', this.key]);
      }));
    }
    this.headingActions = actions;
  }

  private addContact(): any {
    this.contactsService.createContact({
      user: ApiHelper.SELF,
      contact: {
        contact: this.user.id
      }
    }).subscribe(() => {
      this.notification.snackBar(this.i18n('{{user}} was added to your contact list', {
        user: this.user.display
      }));
      this.reload();
    });
  }

  private removeContact(): any {
    this.contactsService.deleteContact(this.user.contact.id).subscribe(() => {
      this.notification.snackBar(this.i18n('{{user}} was removed to your contact list', {
        user: this.user.display
      }));
      this.reload();
    });
  }

  get myProfile(): boolean {
    return !!this.user && (this.login.user || {}).id === this.user.id;
  }

  get title(): string {
    return this.myProfile ? this.i18n('My profile') : (this.user || {}).display;
  }

  fitAddressesBounds() {
    this.addressMapFitBounds$.next(fitBounds(this.locatedAddresses));
  }

}
