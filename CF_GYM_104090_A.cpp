//Stop learning useless algorithms, go and solve some problems, learn how to use binary search.
#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
ll exgcd(ll )
void solve(){
    int n,m;
    cin>>n>>m;
    vector<ll>a(n+1);
    ll s=0;
    for(int i=1;i<=n;i++) cin>>a[i],s+=a[i];
    ll g=gcd(n*(n+1)/2,n);
    cout<<(s-s/g*g+m)%m<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;//cin>>T;
    while(T--) solve();
    return 0;
}