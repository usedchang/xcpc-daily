#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
ll exgcd(ll a,ll b,ll &x,ll &y) {
    if(!b){
        x=1,y=0;
        return a;
    }
    ll d=exgcd(b,a%b,y,x);
    y-=a/b*x;
    return d;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    ll n,m;
    cin>>n>>m;
    vector<ll>a(n+1);
    ll s=0;
    for(int i=1;i<=n;i++) cin>>a[i],s=(s+a[i])%m;
    ll g=gcd(m,gcd(n,n*(n+1)/2));
    ll ans=s-s/g*g;
    cout<<ans<<endl;
    ll s1=gcd(n,n*(n+1)/2),s2=m;
    ll A1,B1,A2,B2;
    ll r1=exgcd(s1,s2,A1,B1);
    ll p=(ans-s)/r1;
    A1*=p;
    ll r2=exgcd(n,n*(n+1)/2,A2,B2);
    A2=(__int128)A2*A1%m,B2=(__int128)B2*A1%m;
    cout<<(A2%m+m)%m<<' '<<(B2%m+m)%m<<endl;
    return 0;
}